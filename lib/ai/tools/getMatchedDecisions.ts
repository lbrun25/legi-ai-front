import {tool} from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import {z} from "zod";
import {MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import puppeteer from 'puppeteer';
import { formatSection } from "./decisionPart";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import { supabaseClient } from "@/lib/supabase/supabaseClient";
import {rerankWithVoyageAI} from '../voyage/reRankers'

const NUM_RELEVANT_CHUNKS = 3500;

interface DecisionPrecision {
  relevance_score: number;
  index: number;
}

const llm = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  configuration: {
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

export const getMatchedDecisionsTool = tool(async (input) => {
  try {
    // Validation de l'entrée
    if (!input.query.trim()) {
      throw new Error("La requête de recherche des décisions ne peut pas être vide");
    }

    // Effectuer la recherche
    const response = await getMatchedDecisions(input.query);
    const decisions = await listDecisions(input.query, response)
    // Vérifier si la réponse est valide
    if (!decisions) {
      return "Aucun résultat trouvé pour cette recherche de décisions.";
    }
    console.log(`[getMatchedDecisionsTool] Pour l'input : "${input.query}", les décisions viennent d'être transmises à l'agent.`);
    return decisions;
  } catch (error: any) {
    console.error("Erreur lors de la recherche des décisions:", error);
    throw new Error(`Erreur lors de la recherche des décsisions: ${error.message}`);
  }
},
{
  name: 'getMatchedDecisions',
  description: "Effectuer une recherche dans la jurisprudence et retourner les résultats les plus pertinents", // reformuler
  schema: z.object({
    query: z.string().describe("Rêquete pour consulter la jurisprudence"), // reformuler
  })
});

/* AVEC ELASTICSEARCH */ // J'ai l'inpression qu'on utilise presque jamais la similarity
export async function getMatchedDecisions(input : any): Promise<bigint[]> {
  console.log("Decisions Input :", input)
  //input = "Est-ce que porteurs des actions de préférence doivent prendre part au vote sur la modification des droits de ces actions de préférence ?";
  if (!input) return [];
  const bm25Results = await ElasticsearchClient.searchDecisions(input, NUM_RELEVANT_CHUNKS);
  if (bm25Results.length === 0)
    return [];
  const bm25IdsForSemantic = bm25Results.map((decision: any) => decision.id);
  const bm25Ids = bm25IdsForSemantic.slice(0, 150)
  /* Optimiser time ici */
  //const label = `[getMatchedDecisions] : Semantic - time for "${input}" :`;
  //console.time(label);
  const semanticResponse = await searchMatchedDecisions(input, 150, bm25IdsForSemantic);
  //console.timeEnd(label);
  /* Optimiser time ici */
  if (semanticResponse.hasTimedOut) return [];
  const semanticIds = semanticResponse.decisions.map((decision) => decision.id);
  if (semanticResponse.decisions.length === 0 || bm25Results.length === 0)
    return [];
  //console.log('Nb bm25Results:', bm25Ids)
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 15, 0.62, 0.38, ); // De base : 0.8 et 0.2 ; Anthropic encourage a tester avec plus // k =0,6 askip marche pas mal // le 18 c'est le nb de decisions a retourner
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id); //result => result.score > 0.5
  //console.log("RANKFUSION : ", rankFusionIds)
  return rankFusionIds;
}
/*
export async function listDecisions(input: string, rankFusionIds: bigint[]) {
  console.log("Decisions FinalRankFusionList :", rankFusionIds);
  const decisionsToRank = await getdecisionsToRank(rankFusionIds)
  const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank)
  const filteredDecisions: any = decisionsRanked.data.filter((decision: DecisionPrecision) => decision.relevance_score >= 0.5);
  //console.log("filteredDecisions : ", filteredDecisions)
  let formattedFiches = "";
  for (let i = 0; i < filteredDecisions.length && i < 7; i++) { // Faire passer les 10 dec à un agent qui refait un résumé et ensuite à cette agent
    const index = decisionsRanked.data[i].index;
    //const content = decisionsToRank[index];
    const id: any = rankFusionIds[index]
    //console.log("Decision print :", id)
    const decision: any = await getDecisionDetailsById(id)
    const decisionContentSingleString = decision[0].decisionContent.replace(/\n/g, ' ');
    //summarizeDecision(decisionContentSingleString) // Permet d'update le content // Mais faut que le for soit dans une boucle promise et que ça revoie tjs classé par pertinence à l'agent
    formattedFiches += `<decision><juridiction>${decision[0].juridiction}</juridiction><date>${decision[0].date}</date><number>${decision[0].number}</number><content>${decisionContentSingleString}</content></decision>\n`;
  }
  //console.log(formattedFiches)
  return formattedFiches;
}
*/

export async function listDecisions(input: string, rankFusionIds: bigint[]) {
  console.log("Decisions FinalRankFusionList :", rankFusionIds);
  let decisionsToRank = await getdecisionsToRank(rankFusionIds);
  let combined: any = { data: [] }; // Déclaration de combined en dehors des blocs conditionnels
  const count = await estimateTokenCount(decisionsToRank);

  if (count !== -1) {
    const decisionsToRank2 = decisionsToRank.slice(count, decisionsToRank.length);
    //console.log("decisionsToRank2 :", decisionsToRank2)
    const decisionsRanked2: any = await rerankWithVoyageAI(input, decisionsToRank2);
    //console.log("decisionsRanked2 :", decisionsRanked2)
    decisionsToRank = decisionsToRank.slice(0, count);
    //console.log("decisionsToRank :", decisionsToRank)
    const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank);
    //console.log("decisionsRanked :", decisionsRanked)
    combined = {
      data: [...decisionsRanked.data, ...decisionsRanked2.data]
    };
  } else {
    const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank);
    combined = decisionsRanked;
  }
  const filteredDecisions: any = combined.data
    .filter((decision: DecisionPrecision) => decision.relevance_score >= 0.5)
    .sort((a: any, b: any) => b.similarity_score - a.similarity_score);

  //console.log("filteredDecisions :", filteredDecisions)
  const decisionPromises = filteredDecisions
    .slice(0, 7)
    .map(async (rankedDecision: any, i: number) => {
      const index = combined.data[i].index;
      const id: any = rankFusionIds[index];
      console.log("Decision print :", id);
      const decisionDetails: any = await getDecisionDetailsById(id);
      const decisionContentSingleString = decisionDetails[0].decisionContent.replace(/\n/g, ' ');
      const newDecisionContent = await summarizeDecision(decisionContentSingleString);

      return {
        juridiction: decisionDetails[0].juridiction,
        date: decisionDetails[0].date,
        number: decisionDetails[0].number,
        content: newDecisionContent,
        originalIndex: i
      };
    });

  const decisions = await Promise.all(decisionPromises);

  const formattedFiches = decisions
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(decision =>
      `<decision><juridiction>${decision.juridiction}</juridiction><date>${decision.date}</date><number>${decision.number}</number><content>${decision.content}</content></decision>`
    )
    .join('\n');

  return formattedFiches;
}

async function summarizeDecision(decisionContent: string) {
  const prompt = `Vous êtes expert dans l'extraction d'information et la rédaction de synthèse juridique.
  
Votre mission est de réaliser une synthèse fidèle et précise d'une décision de justice en capturant tous les arguments et précisions retenus par les juges.

Contenu de la décision : ${decisionContent}

Instructions de raisonnement (étape par étape) :

1. Lisez attentivement la décision.

2. Analysez et distinguez : 
  - Faits essentiels en lien avec la décision
  - Arguments principaux des parties (uniquement ceux discutés dans la décision finale)
  - Raisonnement des premiers juges (si pertinent pour comprendre la décision finale)
  - Raisonnement et arguments du dernier juge
  - Fondements juridiques explicites et implicites
  - Solution retenue (sans inclure les dépens sauf si c'est le coeur de la décision)

3. Traitement des références :
  - Identifiez toutes les références juridiques dans le document
  - Pour chaque mention du type "texte susvisé", "disposition précitée", etc. :
    1. Recherchez la référence complète dans l'ensemble du document
    2. Remplacez la mention par la référence exacte
    3. Vérifiez qu'il s'agit bien de la bonne référence en cas de mentions multiples

Exigences cruciales :
- Longueur : Entre 500 et 1500 tokens selon la richesse du contenu
- Restez STRICTEMENT fidèle au contenu explicite de la décision
- N'interprétez PAS, n'extrapolez PAS
- N'ajoutez aucune connaissance personnelle
- Capturez l'intégralité des arguments et précisions retenues par le juge final
- Reprenez les citations exactes pour les points juridiques cruciaux

Format de sortie :

Faits : [Une ou deux phrases présentant uniquement les faits essentiels directement liés à la question juridique traitée]

Décision : [Citation exacte de l'argument retenue par le dernier juge pour sa solution]

Raisonnement : 
- [Résumé structuré et fidèle du raisonnement du dernier juge]
- [Si pertinent : mention explicite des positions antérieures uniquement pour contextualiser la décision finale]
- [Inclusion des références juridiques complètes en remplacement des mentions implicites]

Précisions juridiques : 
- [Liste des nuances et conditions explicites apportées par le dernier juge]
- [Citations exactes des points juridiques cruciaux]

Avant de finaliser, vérifiez que :
- Toutes les références implicites ont été remplacées par leurs références complètes
- Chaque argument du juge final est inclus
- Le contenu reste entre 500-1500 tokens
- Toutes les citations sont exactes
- Aucune interprétation personnelle n'a été ajoutée
- Les dépens ne sont mentionnés que s'ils constituent le cœur de la décision`

  const llmResponse = await llm.invoke(prompt);
  //console.log("LLM RESPONSE SITE :", llmResponse.content);
  return llmResponse.content;
}

async function getDecisionDetailsById(id: number, maxRetries = 5, delayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabaseClient
        .from('legaldecisions_test_old')
        .select('juridiction, date, number, decisionContent')
        .eq('id', id);

      if (error) {
        console.error(`[getDecisionDetailsById] Tentative ${attempt + 1}/${maxRetries + 1} - Erreur lors de la récupération:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        return null;
      }

      return data;
    } catch (err) {
      console.error(`Tentative ${attempt + 1}/${maxRetries + 1} - Erreur:`, err);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      return null;
    }
  }
  return null;
}

//Ici ça récupere le contenu des décisions dans la db
async function getdecisionsToRank(ids: bigint[]): Promise<string[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // délai de 1 seconde entre les tentatives

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabaseClient
        .from('legaldecisions_test_old')
        .select('id, decisionContent')
        .in('id', ids);

      if (error) {
        console.log(`Tentative ${attempt}/${MAX_RETRIES} - Error fetching decisions:`, error);
        if (attempt === MAX_RETRIES) {
          return [];
        }
        await delay(RETRY_DELAY);
        continue;
      }

      if (data) {
        const decisionMap = new Map(data.map(item => [item.id, item.decisionContent]));
        return ids.map(id => {
          const content = decisionMap.get(id);
          return content ? content.replace(/\n\s*/g, ' ').trim() : '';
        });
      }

      return [];
    } catch (error) {
      console.log(`Tentative ${attempt}/${MAX_RETRIES} - Error in fetching decisions:`, error);
      if (attempt === MAX_RETRIES) {
        return [];
      }
      await delay(RETRY_DELAY);
    }
  }

  return [];
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
      console.log("[estimateTokenCount in decision] : over the token limit")
      return i;
    }
  }

  // Si on n'a jamais dépassé la limite, retourner -1
  return -1;
}
