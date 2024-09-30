import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import puppeteer from 'puppeteer';
import { formatSection } from "./decisionPart";

export const getMatchedDecisions = tool(async (input) => {
  if (!input.query) return ""; // SI JE FILE LA QUERY A UN LLM POUR BIEN REDIGER NOTEMMENT SI JE VEUX DES METADATA EN PLUS
  const matchedDecisionsResponse = await searchMatchedDecisions(input.query);
  if (matchedDecisionsResponse.hasTimedOut) return "";
  return "#" + matchedDecisionsResponse.decisions?.map((decision: MatchedDecision) => `Décision de la ${decision.juridiction} ${decision.number} du ${decision.date} : ${decision.ficheArret}`).join("#");
}, {
  name: 'getMatchedDecisions',
  description: "Obtient la position de la jurisprudence sur la question de droit formulée",
  schema: z.object({
    query: z.string().describe("Question rédigée sur le modèle d’une question de droit dans une fiche d’arrêt."),
  })
})

const extractDecisionLinks = (matchedDecisionsResponse: { decisions?: MatchedDecision[] }): string[] => {
  // Vérifiez si decisions existe et est un tableau, puis retournez un tableau des liens
  return matchedDecisionsResponse.decisions?.map((decision: MatchedDecision) => decision.decisionLink) || [];
};

/* ICI ON A LA FCT POUR RECERHCER DANS LA DB*/
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
      return decisionContent;
  } catch (error) {
      console.error(`Error processing old legal decision: ${error}`);
  }
}


export const fetchPageContent = async (url: string) => { // Ajout d'un paramètre url
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
