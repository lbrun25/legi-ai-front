"use server"
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { googleSearchWithReranking, SearchResult } from "@/lib/ai/tools/webSearch";

const llm = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  configuration: {
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

async function summarizePageContent(pageContent: string) {
    const prompt = `Instructions pour l'analyse du contenu suivant :
${pageContent}

Mission : 
Réaliser une synthèse fidèle et précise du contenu, en respectant ces règles :
- Longueur : Entre 500 et 2000 tokens selon la richesse du contenu
- Reformulation : Possible tant que le sens reste strictement identique
- Citations : Inclure TOUS les articles et sources juridiques explicitement mentionnés dans le texte
  * Format articles : (Article X.XXX-XX Code YYY) - n'ajouter le nom du code que s'il est explicitement mentionné ou logiquement certain
  * Format décisions : (Décision : date n°XX-XXX-XXX)
  * Format autres sources : respecter la formulation exacte du texte
- Organisation : Vous pouvez réorganiser logiquement les informations pour plus de clarté
- Articles : S'assurer d'identifier et présenter TOUS les articles mentionnés avec leur contexte et contenu exact

Important :
- Ne pas extrapoler ou interpréter au-delà du texte
- Ne pas ajouter de sources non explicitement citées
- Ne pas déduire le nom d'un code en cas de doute
- Couvrir l'ensemble des informations sans priorisation
- Porter une attention particulière à la retranscription fidèle du contenu de chaque article cité

Format de réponse :
[Votre synthèse incluant les sources entre parenthèses]`

    const llmResponse = await llm.invoke(prompt);
    //console.log("LLM RESPONSE SITE :", llmResponse.content);
    return llmResponse.content;
}

export async function processSearchResults(results: SearchResult[]) {
    try {
        // Traiter chaque résultat en parallèle
        const enhancedResults = await Promise.all(
            results.map(async (result) => {
                const summary: any = await summarizePageContent(result.content);
                // On retire le content et on ajoute le summary
                const { content, ...resultWithoutContent } = result;
                return {
                    ...resultWithoutContent,
                    summary
                };
            })
        );
        console.log(`[ProcessSearchResults]: ${results.length} résultats traités avec succès`);
        return enhancedResults;
    } catch (error: any) {
        console.error("Erreur lors du traitement des résultats:", error);
        throw new Error(`Erreur lors du traitement: ${error.message}`);
    }
}

export const webSearch = tool(async (input) => {
    try {
        // Validation de l'entrée
        if (!input.query.trim()) {
            throw new Error("La requête de recherche ne peut pas être vide");
        }

        // Effectuer la recherche
        const response = await googleSearchWithReranking(input.query);
        // Vérifier si la réponse est valide
        if (!response || !Array.isArray(response) || response.length === 0) {
            return "Aucun résultat trouvé pour cette recherche.";
        }

        // Traiter les résultats pour obtenir les résumés
        const enhancedResults = await processSearchResults(response);
        
        console.log("[WebSearchTool]: Resultats internet résumés et transmis à l'agent.")
        
        /*enhancedResults.forEach((result, index) => {
          console.log(`--- Page ${index + 1} ---`);
          console.log(`Date de Publication: ${result.publishedDate || 'Non spécifiée'}`);
          console.log(`Score: ${result.similarity_score.toFixed(3)}`);
          console.log(`URL: ${result.link}`);
          console.log(`Titre: ${result.title}`);
          console.log(`Contenu: ${result.summary}`);
          console.log("------------------------");
        });*/
        // Formater les résultats avec uniquement les résumés
        return enhancedResults
            .map((result) => {
                let formattedResult = [
                    `<PageContent>`,
                    `# ${result.title}`,
                    `# Date de publication ${result.publishedDate || 'Non spécifiée'}`,
                    `# Similarity_score: ${result.similarity_score}`,
                    `# Résumé : ${result.summary}`,
                    `URL: ${result.link}`,
                    `</PageContent>`
                ];

                return formattedResult.join('\n');
            })
            .join('\n\n');
    } catch (error: any) {
        console.error("Erreur lors de la recherche web:", error);
        throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
}, {
    name: "webSearch",
    description: "Effectuer une recherche sur internet et retourner les résumés des résultats les plus pertinents",
    schema: z.object({
        query: z
            .string()
            .min(1, "La requête doit contenir au moins un caractère")
            .describe("Requête à rechercher sur Google"),
    }),
});

// VERSION EN DESSOUS SANS SUMMARY DU CONTENT

/*import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { googleSearchWithReranking, SearchResult } from "@/lib/ai/tools/webSearch";

export const webSearch = tool(async (input) => {
    try {
      // Validation de l'entrée
      if (!input.query.trim()) {
        throw new Error("La requête de recherche ne peut pas être vide");
      }

      // Effectuer la recherche
      const response = await googleSearchWithReranking(input.query);

      // Vérifier si la réponse est valide
      if (!response || !Array.isArray(response) || response.length === 0) {
        return "Aucun résultat trouvé pour cette recherche.";
      }
      console.log("[WebSearchTool]: Resultats internet transmis à l'agent.")
      // Formater les résultats
      return response
        .map((result: SearchResult) => {
          
          // Construction du résultat
          let formattedResult = [
            `# ${result.title}`,
            `# Date de publication ${result.publishedDate}`,
            result.content,
            `Similarity_score: ${result.similarity_score}`,
            `URL: ${result.link}`
          ];

          return formattedResult.join('\n');
        })
        .join('\n\n');
    } catch (error: any) {
      console.error("Erreur lors de la recherche web:", error);
      throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
  },
  {
    name: "webSearch",
    description: "Effectuer une recherche sur internet et retourner les résultats les plus pertinents",
    schema: z.object({
      query: z
        .string()
        .min(1, "La requête doit contenir au moins un caractère")
        .describe("Requête à rechercher sur Google"),
    }),
  }
);*/

/* CODE POUR PASSER CONTENU SITE À AUTRE PAGE
        const formattedResults = enhancedResults.map((result) => {
        let formattedResult = [
            `# ${result.title}`,
            `# Date de publication ${result.publishedDate || 'Non spécifiée'}`,
            `# Similarity_score: ${result.similarity_score}`,
            `# Résumé : ${result.summary}`,
            `URL: ${result.link}`
        ];

          return formattedResult.join('\n');
        })
        .join('\n\n');
        const searchKey = `search-${Date.now()}`;
        // Sauvegarder les résultats
        await setSearchResults(searchKey, formattedResults);
        // Stocker searchKey pour accès ultérieur
        global.latestSearchKey = searchKey; // On peut aussi utiliser une autre méthode de stockage selon vos besoins
        return formattedResults; // ce return ça sera ce que l'agent recoit
        */

    /*
      } catch (error: any) {
        console.error("Erreur lors de la recherche web:", error);
        throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
}, {
    name: "webSearch",
    description: "Effectuer une recherche sur internet et retourner les résumés des résultats les plus pertinents",
    schema: z.object({
        query: z
            .string()
            .min(1, "La requête doit contenir au moins un caractère")
            .describe("Requête à rechercher sur Google"),
    }),
});

// VERSION EN DESSOUS SANS SUMMARY DU CONTENT

/*import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { googleSearchWithReranking, SearchResult } from "@/lib/ai/tools/webSearch";

export const webSearch = tool(async (input) => {
    try {
      // Validation de l'entrée
      if (!input.query.trim()) {
        throw new Error("La requête de recherche ne peut pas être vide");
      }

      // Effectuer la recherche
      const response = await googleSearchWithReranking(input.query);

      // Vérifier si la réponse est valide
      if (!response || !Array.isArray(response) || response.length === 0) {
        return "Aucun résultat trouvé pour cette recherche.";
      }
      console.log("[WebSearchTool]: Resultats internet transmis à l'agent.")
      // Formater les résultats
      return response
        .map((result: SearchResult) => {
          
          // Construction du résultat
          let formattedResult = [
            `# ${result.title}`,
            `# Date de publication ${result.publishedDate}`,
            result.content,
            `Similarity_score: ${result.similarity_score}`,
            `URL: ${result.link}`
          ];

          return formattedResult.join('\n');
        })
        .join('\n\n');
    } catch (error: any) {
      console.error("Erreur lors de la recherche web:", error);
      throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
  },
  {
    name: "webSearch",
    description: "Effectuer une recherche sur internet et retourner les résultats les plus pertinents",
    schema: z.object({
      query: z
        .string()
        .min(1, "La requête doit contenir au moins un caractère")
        .describe("Requête à rechercher sur Google"),
    }),
  }
);*/

/* POUR PASSER RESULTAT SITE A AUTRE PAGE 
// Variable pour stocker les résultats temporairement sur le serveur
let searchResults: { [key: string]: string } = {};

// Action pour sauvegarder les résultats
export async function setSearchResults(key: string, results: string) {
  searchResults[key] = results;
}

// Action pour récupérer les résultats
export async function getSearchResults(key: string) {
  return searchResults[key] || null;
}

// Action pour effacer les résultats
export async function clearSearchResults(key: string) {
  delete searchResults[key];
}

// Pour récupérer la dernière searchKey
export function getLastSearchKey() {
  return global.latestSearchKey;
}*/