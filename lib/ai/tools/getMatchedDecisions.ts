import {MatchedDecision, searchDecisionsByIds, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import puppeteer from 'puppeteer';
import {formatSection} from "./decisionPart";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {rerankWithVoyageAI} from '../voyage/reRankers'
import {DOMImplementation, XMLSerializer} from '@xmldom/xmldom';
import {BigInt} from "postgres";

const NUM_RELEVANT_CHUNKS = 150;

/* AVEC ELASTICSEARCH */ // J'ai l'inpression qu'on utilise presque jamais la similarity
export async function getMatchedDecisions(input: any) {
  if (!input) return "";
  const semanticResponse = await searchMatchedDecisions(input, 50);
  console.log('Nb semanticResponse:', semanticResponse.decisions.length)
  if (semanticResponse.hasTimedOut) return "";
  const bm25Results = await ElasticsearchClient.searchDecisions(input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.decisions.length === 0 || bm25Results.length === 0)
    return "";

  const semanticIds = semanticResponse.decisions.map((decision) => decision.id);
  const bm25Ids = bm25Results.map((decision: any) => decision.id);
  console.log('Nb bm25Results:', bm25Ids)
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.65, 0.35); // De base : 0.8 et 0.2 ; Anthropic encourage a tester avec plus // k =0,6 askip marche pas mal // le 18 c'est le nb de decisions a retourner
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id); //result => result.score > 0.5
  console.log("RANKFUSION : ", rankFusionIds)
  const decisionInfos = await getDecisionLinks(rankFusionIds);
  const decisionLinks = decisionInfos.map((decisionInfos) => decisionInfos.link);
  const decisionsToRank = await getdecisionsToRank(decisionLinks)
  const decisionsRanked: any = await rerankWithVoyageAI(input, decisionsToRank)
  console.log("ReRanked : ", decisionsRanked)

  const filteredFullContentDecisions: Record<string, string> = {}; // <id, content>
  for (let i = 0; i < decisionsToRank.length; i++) {
    const index = decisionsRanked.data[i].index;
    const content = decisionsToRank[index];
    const id = rankFusionIds[index];
    filteredFullContentDecisions[id.toString()] = content;
  }
  const decisionIds = Object.keys(filteredFullContentDecisions).map(key => globalThis.BigInt(key));
  const filteredDecisions = await searchDecisionsByIds(decisionIds);
  if (!filteredDecisions) return "";

  return convertDecisionsToXML(filteredDecisions, filteredFullContentDecisions);
}

async function convertDecisionsToXML(
  decisions: { id: string, juridiction: string, date: string, number: string }[],
  fullContentDecisions: Record<string, string>
) {
  const domImplementation = new DOMImplementation();
  const document = domImplementation.createDocument(null, 'decisions', null);
  const rootElement = document.documentElement;
  if (!rootElement) return "";

  decisions.forEach(decision => {
    // Create <decision> element
    const decisionElement = document.createElement('decision');

    // Create <juridiction> element
    const juridictionElement = document.createElement('juridiction');
    juridictionElement.textContent = decision.juridiction;
    decisionElement.appendChild(juridictionElement);

    // Create <number> element
    const numberElement = document.createElement('number');
    numberElement.textContent = decision.number;
    decisionElement.appendChild(numberElement);

    // Create <date> element
    const dateElement = document.createElement('date');
    dateElement.textContent = decision.date;
    decisionElement.appendChild(dateElement);

    // Create <content> element
    const contentElement = document.createElement('content');
    contentElement.textContent = fullContentDecisions[decision.id];
    decisionElement.appendChild(contentElement);

    // Append <decision> to the root element
    rootElement.appendChild(decisionElement);
  });
  const serializer = new XMLSerializer();
  return serializer.serializeToString(document);
}

//treatDecision
async function getdecisionsToRank(links: any[]): Promise<string[]> {
  const content: any = [];
  for (const link of links) {
    try {
      //console.log(link)
      const decisionContent: any = await treatDecision(link)
      const formattedContent = decisionContent.replace(/\n\s*/g, ' ').trim();
      content.push(formattedContent)
    } catch (error) {
      console.log('Error in getting getdecisionsToRank', error);
    }
  }
  return content;
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
    const {data, error} = await supabaseClient
      .from('legaldecisions_test') // Remplacez par le nom de votre table
      .select('decisionLink')
      .eq('id', idInt)
      .single(); // S'attend à un seul résultat

    if (error) {
      console.error(`Erreur lors de la récupération du lien pour l'ID ${idInt}:`, error);
    } else if (data) {
      links.push({id: id, link: data.decisionLink});
    }
  }

  return links; // Renvoie la liste des liens
}

/* DECISIONS COMPLETE */

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
  console.log('Will scrap')
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  const page = await browser.newPage();

  // Set a custom User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');

  // Navigate to the target URL
  await page.goto(url, {waitUntil: 'networkidle2'}); // Utilisation de l'URL passée en paramètre

  // Wait for the content to load
  await page.waitForSelector('title'); // Adjust selector as needed

  const content = await page.content(); // Get the HTML content
  await browser.close(); // Close the browser
  console.log('Scraped closed')
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
    } else {
      try { // Ici ca s'occupe de recuperer les decisions sur la version recente du site et de le mettre dans le json
        const decisionContent = await formatDecisionContent($);
        return extractDecisionContentFromString(decisionContent);
      } catch (error) {
        console.error(`Failed to process decision from link with new version: ${link}`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to process decision from link: ${link}`, error);
  }
}
