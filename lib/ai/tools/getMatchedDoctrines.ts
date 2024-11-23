import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getDoctrinesByIds, MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";
import {DOMImplementation, XMLSerializer} from '@xmldom/xmldom';

const NUM_RELEVANT_CHUNKS = 500;

interface DoctrinesPrecision {
  relevance_score: number;
  index: number;
}

export const getMatchedDoctrinesTool = tool(async (input) => {
  try {
    // Validation de l'entrée
    if (!input.query.trim()) {
      throw new Error("La requête de recherche des doctrines ne peut pas être vide");
    }

    // Effectuer la recherche
    const response = await getMatchedDoctrines(input.query);
    const doctrines = await listDoctrines(input.query, response)
    // Vérifier si la réponse est valide
    if (!doctrines) {
      return "Aucun résultat trouvé pour cette recherche de doctrines.";
    }
    console.log(`[getMatchedDoctrinesTool] Pour l'input : "${input.query}", les doctrines viennent d'être transmises à l'agent.`);
    return doctrines;
  } catch (error: any) {
    console.error("Erreur lors de la recherche des doctrines:", error);
    throw new Error(`Erreur lors de la recherche des doctrines: ${error.message}`);
  }
},
{
  name: 'getMatchedDoctrines',
  description: "Obtient les doctrines les plus similaires à la rêquete",
  schema: z.object({
    query: z.string().describe("Rêquete pour consulter la doctrine"),
  })
});

export async function getMatchedDoctrines(input: any): Promise<bigint[]> {
  //console.log("input :", input)
  //console.time("getMatchedDoctrines")
  if (!input) return [];
  const bm25Results = await ElasticsearchClient.searchDoctrines(input, NUM_RELEVANT_CHUNKS);
  if (bm25Results.length === 0)
    return [];
  const bm25IdsForSemantic = bm25Results.map((doctrine: any) => doctrine.id);
  const bm25Ids = bm25IdsForSemantic.slice(0, 150);
  //console.log('Nb bm25Results doctrines:', bm25Ids);
  const semanticResponse = await searchMatchedDoctrines(input, 150, bm25IdsForSemantic);
  if (semanticResponse.hasTimedOut) return [];
  if (semanticResponse.doctrines.length === 0 || bm25Results.length === 0)
    return [];
  const semanticIds = semanticResponse.doctrines.map((doctrine) => doctrine.id);
  //console.log("Semantic doctrines ids :", semanticIds);
  //const bm25Ids = bm25Results.map((doctrine: any) => doctrine.id);
  //console.log('Nb bm25Results doctrines:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 100, 0.65, 0.35);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  //console.log("RANKFUSION doctrines: ", rankFusionIds);
  return rankFusionIds;
}

export async function listDoctrines(input: string, rankFusionIds: bigint[]):Promise <string>
{
  console.log("doctrine ids :", rankFusionIds)
  let doctrinesToRank = await getDoctrinesByIds(rankFusionIds);
  if (!doctrinesToRank) return "";
  let doctrinesContentToRank = doctrinesToRank?.map((doctrine) => doctrine.contextual_content as string);
  if (!doctrinesContentToRank) return "";
  const res = await estimateTokenCount(doctrinesContentToRank)
  if (res !== -1)
  {
    console.log("[Doctrine estimateTokenCount] slice :", res);
    doctrinesContentToRank.slice(res);
  }
  const doctrinesRanked: any = await rerankWithVoyageAI(input, doctrinesContentToRank);
  const filteredDoctrines: any = doctrinesRanked.data.filter((doctrine: DoctrinesPrecision) => doctrine.relevance_score >= 0.5);
  let doctrinesFormatted = "";

  for (let i = 0; i < filteredDoctrines.length && i < 25; i++) {
    const index = doctrinesRanked.data[i].index;
    const doctrine: any = doctrinesToRank[index];
    doctrinesFormatted += `<doctrines><doctrine_domaine>${doctrine.bookTitle}</doctrine_domaine><content>${doctrine.contextual_content}</content></doctrines>\n`;
  }
  return doctrinesFormatted;
}

async function estimateTokenCount(strings: string[]): Promise<number> {
  const TOKEN_LIMIT = 280000;
  const AVERAGE_CHARS_PER_TOKEN = 4;
  const WHITESPACE_FACTOR = 1.2;
  const PUNCTUATION_FACTOR = 1.1;
  
  let runningTotal = 0;
  
  for (let i = 0; i < strings.length; i++) {
    const str = strings[i];
    
    // Compte les caractères
    const charCount = str.length;
    
    // Compte les espaces pour ajuster l'estimation
    const whitespaceCount = (str.match(/\s/g) || []).length;
    
    // Compte la ponctuation pour ajuster l'estimation
    const punctuationCount = (str.match(/[.,!?;:'"()\[\]{}]/g) || []).length;
    
    // Calcul de base : caractères divisés par la moyenne de caractères par token
    let baseEstimate = charCount / AVERAGE_CHARS_PER_TOKEN;
    
    // Ajustement pour les espaces et la ponctuation
    baseEstimate *= (1 + (whitespaceCount / charCount) * WHITESPACE_FACTOR);
    baseEstimate *= (1 + (punctuationCount / charCount) * PUNCTUATION_FACTOR);
    
    const estimatedTokens = Math.ceil(baseEstimate);
    runningTotal += estimatedTokens;
    
    // Si on dépasse la limite, retourner l'index actuel
    if (runningTotal > TOKEN_LIMIT) {
      return i;
    }
  }
  
  // Si on n'a jamais dépassé la limite, retourner -1
  return -1;
}