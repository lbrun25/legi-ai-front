import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getDoctrinesByIds, MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";
import {DOMImplementation, XMLSerializer} from '@xmldom/xmldom';

const NUM_RELEVANT_CHUNKS = 150;

interface DoctrinesPrecision {
  relevance_score: number;
  index: number;
}

export const getMatchedDoctrinesTool = tool(async (input) => {
  console.log("Doctrines :", input)
  return getMatchedDoctrines(input.query);
}, {
  name: 'getMatchedDoctrines',
  description: "Obtient les doctrines les plus similaires à la demande de l'utilisateur",
  schema: z.object({
    query: z.string().describe("La description du problème que l'utilisateur tente de résoudre"),
  })
})

export async function getMatchedDoctrines(input: any): Promise<bigint[]> {
  console.log("input :", input)
  //console.time("getMatchedDoctrines")
  if (!input) return [];
  const bm25Results = await ElasticsearchClient.searchDoctrines(input, NUM_RELEVANT_CHUNKS);
  if (bm25Results.length === 0)
    return [];
  //const bm25IdsForSemantic = bm25Results.map((decision: any) => decision.id);
  //const bm25Ids = bm25IdsForSemantic.slice(0, 150);
  //console.log('Nb bm25Results doctrines:', bm25Ids);
  const semanticResponse = await searchMatchedDoctrines(input, 40);
  if (semanticResponse.hasTimedOut) return [];
  if (semanticResponse.doctrines.length === 0 || bm25Results.length === 0)
    return [];
  const semanticIds = semanticResponse.doctrines.map((doctrine) => doctrine.id);
  //console.log("Semantic doctrines ids :", semanticIds);
  const bm25Ids = bm25Results.map((doctrine: any) => doctrine.id);
  //console.log('Nb bm25Results doctrines:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 50, 0.65, 0.35);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  //console.log("RANKFUSION doctrines: ", rankFusionIds);
  return rankFusionIds;
}

export async function listDoctrines(input: string, rankFusionIds: bigint[]):Promise <string>
{
  //console.log("In list doctrines for :", input)
  console.log("doctrine ids :", rankFusionIds)
  const doctrinesToRank = await getDoctrinesByIds(rankFusionIds);
  if (!doctrinesToRank) return "";
  const doctrinesContentToRank = doctrinesToRank?.map((doctrine) => doctrine.paragrapheContent as string);
  if (!doctrinesContentToRank) return "";
  const doctrinesRanked: any = await rerankWithVoyageAI(input, doctrinesContentToRank);
  const filteredDoctrines: any = doctrinesRanked.data.filter((doctrine: DoctrinesPrecision) => doctrine.relevance_score >= 0.5);
  console.log("filteredDoctrines : ", filteredDoctrines)
  let doctrinesFormatted = "";
  for (let i = 0; i < filteredDoctrines.length && i < 20; i++) { // Faire passer les 10 dec à un agent qui refait un résumé et ensuite à cette agent
    const index = doctrinesRanked.data[i].index;
    //const content = doctrinesToRank[index];
    const doctrine: any = doctrinesToRank[index];
    //console.log("ParagrapheNB :", doctrine.paragrapheNumber)
    //console.log(`${doctrine.bookTitle} : ${doctrine.paragrapheContent}`)
    doctrinesFormatted += `<doctrines><doctrine_domaine>${doctrine.bookTitle}</doctrine_domaine><content>${doctrine.paragrapheContent}</content></doctrines>\n`;
  }
  //console.log(formattedFiches)
  return doctrinesFormatted;
}

// Convert the result to XML format
function convertDoctrinesToXML(doctrines: { paragrapheNumber: string, paragrapheContent: string }[]): string {
  const domImplementation = new DOMImplementation();
  const document = domImplementation.createDocument(null, 'doctrines', null);
  const rootElement = document.documentElement;
  if (!rootElement) return "";

  doctrines.forEach((doctrine) => {
    // Create <doctrine> element
    const doctrineElement = document.createElement('doctrine');

    // Create <paragrapheNumber> element
    const numberElement = document.createElement('paragrapheNumber');
    numberElement.textContent = doctrine.paragrapheNumber.toString();
    doctrineElement.appendChild(numberElement);

    // Create <paragrapheContent> element
    const contentElement = document.createElement('paragrapheContent');
    contentElement.textContent = doctrine.paragrapheContent;
    doctrineElement.appendChild(contentElement);

    // Append <doctrine> to the root element
    rootElement.appendChild(doctrineElement);
  });
  const serializer = new XMLSerializer();
  return serializer.serializeToString(document);
}
