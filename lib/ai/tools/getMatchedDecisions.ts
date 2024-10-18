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

const NUM_RELEVANT_CHUNKS = 5000;

interface DecisionPrecision {
  relevance_score: number;
  index: number;
}

/* AVEC ELASTICSEARCH */ // J'ai l'inpression qu'on utilise presque jamais la similarity
export async function getMatchedDecisions(input : any): Promise<bigint[]> { 
  console.log("input :", input)
  console.time("getMatchedDecisions")
  //input = "Est-ce que porteurs des actions de préférence doivent prendre part au vote sur la modification des droits de ces actions de préférence ?";
  if (!input) return [];
  const bm25Results = await ElasticsearchClient.searchDecisions(input, NUM_RELEVANT_CHUNKS);
  if (bm25Results.length === 0)
    return [];
  const bm25IdsForSemantic = bm25Results.map((decision: any) => decision.id);
  const bm25Ids = bm25IdsForSemantic.slice(0, 150);
  const semanticResponse = await searchMatchedDecisions(input, 150, bm25IdsForSemantic);
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
  console.timeEnd("getMatchedDecisions")
  return formattedFiches;
}

async function getDecisionDetailsById(id: number) {
  try {
    const { data, error } = await supabaseClient
      .from('legaldecisions_test')  // Remplacez par le nom de votre table
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
    // Utilise Promise.all pour exécuter les requêtes simultanément
    const contentPromises = ids.map(async (id) => {
      //console.log(`Fetching decision content for ID: ${id}`);
      
      const { data, error } = await supabaseClient
        .from('legaldecisions_test') // Remplace 'your_table_name' par le nom de ta table
        .select('decisionContent')
        .eq('id', id)
        .single(); // On s'attend à récupérer une seule ligne par ID

      if (error) {
        console.log(`Error fetching content for ID: ${id}`, error);
        return ''; // Retourne une chaîne vide si une erreur survient pour un ID
      }

      if (data) {
        return data.decisionContent.replace(/\n\s*/g, ' ').trim();
      }

      return ''; // Retourne une chaîne vide si pas de data
    });

    // Résout toutes les promesses et retourne les contenus sous forme de tableau
    const content = await Promise.all(contentPromises);
    return content;
  } catch (error) {
    console.log('Error in fetching decisions:', error);
    return [];
  }
}

