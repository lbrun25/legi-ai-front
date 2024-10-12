import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getFullDecisionsByIds, MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import puppeteer from 'puppeteer';
import { formatSection } from "./decisionPart";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import { supabaseClient } from "@/lib/supabase/supabaseClient";
import {rerankWithVoyageAI} from '../voyage/reRankers'

const NUM_RELEVANT_CHUNKS = 150;

interface DecisionPrecision {
  relevance_score: number;
  index: number;
}

/* AVEC ELASTICSEARCH */ // J'ai l'inpression qu'on utilise presque jamais la similarity
export async function getMatchedDecisions(input : any): Promise<bigint[]> {
  console.log("input :", input)
  //input = "Est-ce que porteurs des actions de préférence doivent prendre part au vote sur la modification des droits de ces actions de préférence ?";
  if (!input) return [];
  const semanticResponse = await searchMatchedDecisions(input, 150);
  //console.log('Nb semanticResponse:', semanticResponse.decisions.length)
  if (semanticResponse.hasTimedOut) return [];
  const bm25Results = await ElasticsearchClient.searchDecisions(input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.decisions.length === 0 || bm25Results.length === 0)
    return [];

  const semanticIds = semanticResponse.decisions.map((decision) => decision.id);
  const bm25Ids = bm25Results.map((decision: any) => decision.id);
  //console.log('Nb bm25Results:', bm25Ids)
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.62, 0.38, ); // De base : 0.8 et 0.2 ; Anthropic encourage a tester avec plus // k =0,6 askip marche pas mal // le 18 c'est le nb de decisions a retourner
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id); //result => result.score > 0.5
  console.log("RANKFUSION : ", rankFusionIds)
  return rankFusionIds;
}

export async function listDecisions(input: string, rankFusionIds: bigint[]) {
  console.log("finalRankFusionList :", rankFusionIds);
  //const decisionInfos = await getDecisionLinks(rankFusionIds);
  //const decisionLinks = decisionInfos.map((decisionInfos) => decisionInfos.link);
  const decisionsToRank = await getDecisionsToRank(rankFusionIds)
  const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank)
  const filteredDecisions: any = decisionsRanked.data.filter((decision: DecisionPrecision) => decision.relevance_score >= 0.5);
  console.log("filteredDecisions : ", filteredDecisions)
  let formattedFiches = "";
  for (let i = 0; i < filteredDecisions.length && i < 10; i++) { // Faire passer les 10 dec à un agent qui refait un résumé et ensuite à cette agent
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

//treatDecision
async function getDecisionsToRank(ids: bigint[]): Promise<string[]> {
  try {
    const decisions = await getFullDecisionsByIds(ids);
    if (!decisions) return [];
    return decisions.map((decision) => decision.decisionContent.replace(/\n\s*/g, ' ').trim());
  } catch (error) {
    console.error("cannot get full decisions by IDs:", error);
  }
  return [];
}

async function getDecisionLinks(ids: any[]): Promise<any[]> {
  const links: any[] = [];

  for (const id of ids) {
    // Conversion de l'ID en entier
    const idInt = parseInt(id.toString(), 10);

    // Vérification si l'ID est un nombre valide
    if (isNaN(idInt)) {
      console.error(`ID non valide: ${id}`);
      continue;
    }

    // Requête pour récupérer le lien correspondant à l'ID actuel
    const { data, error } = await supabaseClient
      .from('legaldecisions_test') // Remplacez par le nom de votre table
      .select('decisionLink')
      .eq('id', idInt)
      .single(); // S'attend à un seul résultat

    if (error) {
      console.error(`Erreur lors de la récupération du lien pour l'ID ${idInt}:`, error);
    } else if (data) {
      links.push({id : id, link: data.decisionLink});
    }
  }

  return links; // Renvoie la liste des liens
}

/* DECISIONS COMPLETE */

const extractDecisionLinks = (matchedDecisionsResponse: { decisions?: MatchedDecision[] }): string[] => {
  // Vérifiez si decisions existe et est un tableau, puis retournez un tableau des liens
  return matchedDecisionsResponse.decisions?.map((decision: MatchedDecision) => decision.decisionLink) || [];
};

export async function getMatchedDecisions2(input: any) {
  if (!input) return "";

  const matchedDecisionsResponse = await searchMatchedDecisions(input);
  if (matchedDecisionsResponse.hasTimedOut) return "";

  const links = extractDecisionLinks(matchedDecisionsResponse);
  //console.log(links)
  let formattedFiches = "---------\n";

  // Boucle sur chaque décision
  for (let i = 0; i < matchedDecisionsResponse.decisions.length; i++) {
    const decision = matchedDecisionsResponse.decisions[i];
    const content = await treatDecision(links[i]); // Traite le lien de chaque décision

    formattedFiches += `Décision de la ${decision.juridiction} ${decision.number} du ${decision.date} : ${content}\n---------\n`;
  }
  //console.log(formattedFiches);
  return formattedFiches;
}

async function extractDecisionContentFromString(decisionContent: string): Promise<string> {
  const annexeIndex = decisionContent.indexOf('MOYEN ANNEXE au présent arrêt') !== -1
      ? decisionContent.indexOf('MOYEN ANNEXE au présent arrêt')
      : decisionContent.indexOf('MOYENS ANNEXES au présent arrêt') !== -1
      ? decisionContent.indexOf('MOYENS ANNEXES au présent arrêt')
      : decisionContent.indexOf('MOYEN ANNEXE à la présente décision') !== -1
      ? decisionContent.indexOf('MOYEN ANNEXE à la présente décision')
      : decisionContent.indexOf('MOYENS ANNEXES à la présente décision') !== -1
      ? decisionContent.indexOf('MOYENS ANNEXES à la présente décision')
      : -1;

  if (annexeIndex !== -1) {
      return decisionContent.slice(0, annexeIndex).trim();
  }
  return decisionContent;
}


async function formatDecisionContent($: cheerio.CheerioAPI) {
	let formattedText = "";
	const decisionElement = $(".decision-element.decision-element--texte-decision");
	const sections = decisionElement.find('div'); // Sélectionner toutes les divs

	sections.each((index, element) => {
		const title = $(element).find('button').text().trim(); // Récupérer le titre du bouton
		const content = $(element).text().trim(); // Define content variable
		//console.log(`Titre extrait : ${title}`); // Log pour vérifier le titre extrait
		const formattedSection = formatSection(title, content); // Format the section
		formattedText += formattedSection; // Append the formatted section to the formattedText
	});

	//console.log("Formatage de la décision terminé.");
	return formattedText.trim();
}

function isCurrentVersion($: CheerioAPI): boolean {
	const elements = $("p.decision-accordeon--contenu");
	return elements.length > 0;
}

async function extractDecisionContent($: cheerio.CheerioAPI): Promise<string> {
  const elements = $(".decision-element.decision-element--texte-decision p");
  const decisionContent = elements.text().trim();

  const annexeIndex = decisionContent.indexOf('MOYEN ANNEXE au présent arrêt') !== -1
      ? decisionContent.indexOf('MOYEN ANNEXE au présent arrêt')
      : decisionContent.indexOf('MOYENS ANNEXES au présent arrêt') !== -1
      ? decisionContent.indexOf('MOYENS ANNEXES au présent arrêt')
      : decisionContent.indexOf('MOYEN ANNEXE à la présente décision') !== -1
      ? decisionContent.indexOf('MOYEN ANNEXE à la présente décision')
      : decisionContent.indexOf('MOYENS ANNEXES à la présente décision') !== -1
      ? decisionContent.indexOf('MOYENS ANNEXES à la présente décision')
      : -1;

  if (annexeIndex !== -1) {
      return decisionContent.slice(0, annexeIndex).trim();
  }
  return decisionContent;
}

export async function scrapingLegalDecisionsWithWebSiteOldFormat(html: string) {
  try {
      const $ = cheerio.load(html);
      const decisionContent = await extractDecisionContent($);
     // console.log(decisionContent)
      return decisionContent;
  } catch (error) {
      console.error(`Error processing old legal decision: ${error}`);
  }
}


export const fetchPageContent = async (url: string) => { // Ajout d'un paramètre url

    if (typeof url !== 'string') {
      throw new Error(`Invalid URL: ${JSON.stringify(url)}`);
    }
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set a custom User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');

    // Navigate to the target URL
    await page.goto(url, { waitUntil: 'networkidle2' }); // Utilisation de l'URL passée en paramètre

    // Wait for the content to load
    await page.waitForSelector('title'); // Adjust selector as needed

    const content = await page.content(); // Get the HTML content
    await browser.close(); // Close the browser
    return content; // Renvoie le contenu HTML
};

export async function treatDecision(link: string) {
	try {
		const html = await fetchPageContent(link);
		const $ = cheerio.load(html);
		const currentVersion = isCurrentVersion($); // ou pas de boutons

		if (!currentVersion) {
			const decisionContent = await scrapingLegalDecisionsWithWebSiteOldFormat(html); // gère le cas ou le site est dans l'ancien format
      return decisionContent;
    }
		else {
			try { // Ici ca s'occupe de recuperer les decisions sur la version recente du site et de le mettre dans le json
				const decisionContent = await formatDecisionContent($);
        return extractDecisionContentFromString(decisionContent);
      }
			catch (error) {
				console.error(`Failed to process decision from link with new version: ${link}`, error);
			}
		}
	} catch (error) {
		console.error(`Failed to process decision from link: ${link}`, error);
	}
}
