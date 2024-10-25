import {tool} from "@langchain/core/tools";
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

export const getMatchedDecisionsTool = tool(async (input) => {
  if (!input.query) return "";
  return getMatchedDecisions(input.query)
}, {
  name: 'getMatchedDecisions',
  description: "Obtient la position de la jurisprudence sur la question de droit formulée",
  schema: z.object({
    query: z.string().describe("Rêquete pour consulter la jurisprudence"),
  })
})

/* AVEC ELASTICSEARCH */ // J'ai l'inpression qu'on utilise presque jamais la similarity
export async function getMatchedDecisions(input : any): Promise<bigint[]> { 
  console.log("input :", input)
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
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.62, 0.38, ); // De base : 0.8 et 0.2 ; Anthropic encourage a tester avec plus // k =0,6 askip marche pas mal // le 18 c'est le nb de decisions a retourner 
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id); //result => result.score > 0.5
  //console.log("RANKFUSION : ", rankFusionIds)
  return rankFusionIds;
}

export async function listDecisions(input: string, rankFusionIds: bigint[]) {
  console.log("finalRankFusionList :", rankFusionIds);
  const decisionsToRank = await getdecisionsToRank(rankFusionIds)
  const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank)
  const filteredDecisions: any = decisionsRanked.data.filter((decision: DecisionPrecision) => decision.relevance_score >= 0.5);
  //console.log("filteredDecisions : ", filteredDecisions)
  let formattedFiches = "";
  for (let i = 0; i < filteredDecisions.length && i < 7; i++) { // Faire passer les 10 dec à un agent qui refait un résumé et ensuite à cette agent
    const index = decisionsRanked.data[i].index;
    //const content = decisionsToRank[index];
    const id: any = rankFusionIds[index]
    const decision: any = await getDecisionDetailsById(id)
    const decisionContentSingleString = decision[0].decisionContent.replace(/\n/g, ' ');
    formattedFiches += `<decision><juridiction>${decision[0].juridiction}</juridiction><date>${decision[0].date}</date><number>${decision[0].number}</number><content>${decisionContentSingleString}</content></decision>\n`;
  }
  //console.log(formattedFiches)
  return formattedFiches;
}

async function getDecisionDetailsById(id: number) {
  try {
    const { data, error } = await supabaseClient
      .from('legaldecisions_test_old')  // Remplacez par le nom de votre table
      .select('juridiction, date, number, decisionContent')
      .eq('id', id);

    if (error) {
      console.error('Erreur lors de la récupération des données:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Erreur:', err);
    return null;
  }
}

//Ici ça récupere le contenu des décisions dans la db
async function getdecisionsToRank(ids: bigint[]): Promise<string[]> {
  try {
    // Exécuter une seule requête pour récupérer toutes les décisions correspondant aux IDs donnés
    const { data, error } = await supabaseClient
      .from('legaldecisions_test_old')
      .select('id, decisionContent')
      .in('id', ids); // Utilise 'in' pour récupérer toutes les lignes correspondant aux IDs

    if (error) {
      console.log('Error fetching decisions:', error);
      return [];
    }

    if (data) {
      // Créer une map pour retrouver facilement les décisions par ID
      const decisionMap = new Map(data.map(item => [item.id, item.decisionContent]));

      // Retourner les décisions dans l'ordre des IDs donnés
      return ids.map(id => {
        const content = decisionMap.get(id);
        return content ? content.replace(/\n\s*/g, ' ').trim() : ''; // Si l'ID n'existe pas, renvoyer une chaîne vide
      });
    }

    return [];
  } catch (error) {
    console.log('Error in fetching decisions:', error);
    return [];
  }
}


