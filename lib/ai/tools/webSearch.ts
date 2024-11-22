import {rerankWithVoyageAIMultiLangual} from "@/lib/ai/voyage/reRankers"
import { embeddingWithVoyageLaw } from "../voyage/embedding";

interface VoyageRerankResponse {
    object: string;
    data: Array<{
      relevance_score: number;
      index: number;
    }>;
    model: string;
    usage: {
      total_tokens: number;
    };
  }
export interface SearchResult {
    title: string;
    link: string;
    content: string;
    similarity_score: number;
    publishedDate?: string; // Changé en string pour stocker le format JJ/MM/AAAA
}

interface GoogleSearchResponse {
    items: {
        title: string;
        link: string;
        snippet: string;
        pagemap?: {
            metatags?: Array<{
                'article:published_time'?: string;
                'date'?: string;
                'og:published_time'?: string;
                'publishedDate'?: string;
                'datePublished'?: string;
            }>;
        };
    }[];
}

function formatDate(dateStr: string): string | undefined {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return undefined;
        
        // Formatage en JJ/MM/AAAA
        const jour = date.getDate().toString().padStart(2, '0');
        const mois = (date.getMonth() + 1).toString().padStart(2, '0');
        const annee = date.getFullYear();
        
        return `${jour}/${mois}/${annee}`;
    } catch (e) {
        console.warn('Erreur lors du parsing de la date:', e);
        return undefined;
    }
}

function extractGooglePublishedDate(item: GoogleSearchResponse['items'][0]): string | undefined {
    if (!item.pagemap?.metatags?.[0]) return undefined;
    
    const metatags = item.pagemap.metatags[0];
    
    // Chercher la date dans différents champs meta possibles
    const dateStr = 
        metatags['article:published_time'] ||
        metatags['date'] ||
        metatags['og:published_time'] ||
        metatags['publishedDate'] ||
        metatags['datePublished'];
    
    if (dateStr) {
        return formatDate(dateStr);
    }
    
    return undefined;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function cleanMarkdownContent(content: string): string {
    // Enlever l'URL source et le temps de publication
    const lines = content.split('\n');
    const cleanedLines = lines.filter(line => 
      !line.startsWith('URL Source:') && 
      !line.startsWith('Published Time:')
    );
    
    // Remplacer "Markdown Content:" par "Contenu de la page:"
    let cleanedContent = cleanedLines.join('\n')
      .replace('Markdown Content:', 'Contenu de la page:');
  
    // Nettoyer le reste du contenu comme avant
    const terminators = [
      '©',
      'Ajouter un commentaire',
      'Partager sur les réseaux',
      'Partager sur',
      'L\'ÉQUIPE',     // Ajout du nouveau terminateur exact
      'L\'EQUIPE',      // Version sans accent
      'NOTRE ÉQUIPE',  // Ajout du nouveau terminateur exact
      'NOTRE EQUIPE',   // Version sans accent
      "Pour consulter cet article dans son intégralité, vous devez être abonné",
      "Pour lire la suite de cet article, vous devez être abonné",
      "Pour accéder à cet article, vous devez être abonné",
      "Cet article est réservé aux abonnés",
      "Abonnez-vous pour lire la suite",
      /*"Réservé aux abonnés",
      'Commentaires',
      'Comments',
      'Share on',
      'Copyright',
      'Tous droits réservés',
      'All rights reserved'*/
    ];
  
    // Trouver la première occurrence d'un des terminateurs
    let firstTerminatorIndex = cleanedContent.length;
    for (const terminator of terminators) {
      const index = cleanedContent.indexOf(terminator);
      if (index !== -1 && index < firstTerminatorIndex) {
        firstTerminatorIndex = index;
      }
    }
  
    // Couper le contenu au premier terminateur trouvé
    if (firstTerminatorIndex !== cleanedContent.length) {
      cleanedContent = cleanedContent.substring(0, firstTerminatorIndex).trim();
    }
    // 3. Nettoyer les liens Markdown de manière plus intelligente
  // Pattern pour détecter les URLs (plus complet que la version précédente)
  const urlPattern = /https?:\/\/[^\s)]+|www\.[^\s)]+|\[([^\]]+)\]\([^)]+\)/;
  // Enlever les liens Markdown standards : [texte](url) -> texte
  cleanedContent = cleanedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Nettoyer uniquement les parenthèses contenant des URLs
  cleanedContent = cleanedContent.replace(/\(([^)]+)\)/g, (match, content) => {
    // Si le contenu entre parenthèses est une URL, on le supprime
    if (urlPattern.test(content)) {
      return '';
    }
    // Sinon, on garde les parenthèses et leur contenu
    return match;
  });

    // 4. Nettoyer les crochets vides et leurs variantes
    cleanedContent = cleanedContent
    // Supprimer les crochets vides avec ou sans espaces à l'intérieur
    .replace(/\[\s*\](\n|\s)*/g, '')
    // Supprimer les crochets vides en fin de ligne
    .replace(/\[\s*\]$/gm, '')
    // Supprimer les séquences de crochets vides
    .replace(/(\[\s*\]\s*)+/g, '');

  // 5. Nettoyer le formatage et les éléments de bouton résiduels
  cleanedContent = cleanedContent
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remplacer les lignes vides multiples par une seule
    .replace(/^\s+|\s+$/g, '')          // Enlever les espaces au début et à la fin
    .replace(/[ \t]+/g, ' ')            // Remplacer les espaces multiples par un seul
    .trim();

  return cleanedContent;
}


async function extractContentWithJina(url: string, retryCount: number = 5): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const jinaApiKey = process.env.NEXT_PUBLIC_JINA_API_KEY;

    const removeSelectors = [
        // Navigation et en-têtes
        "nav",
        "Nav",
        ".nav",
        ".Nav",
        "navbar",
        "NavBar",
        ".navbar",
        ".NavBar",
        "navBar",
        "Navbar",
        ".navBar",
        ".Navbar",
        "header",
        "[class*='HeaderNavBar__']",        // Tous les éléments avec HeaderNavBar
        "[class*='HeaderHoverMenu__']",     // Tous les éléments avec HeaderHoverMenu
        "[class*='Nav']",                   // Tous les éléments contenant Nav dans leur classe
        "[class*='Menu']",
        ".top-header",
        ".site-header",
        ".main-header",
        ".page-header",
        "#header",
        "#top-header",
        ".navbar",
        ".navigation",

        // Images et médias
        "img",
        "video",
        "audio",
        "iframe",
        
        // Éléments périphériques
        "footer",
        "aside",
        ".sidebar",
        "#sidebar",
       // "[class*='breadcrumb']",     // Toute classe contenant 'breadcrumb'
       // "[id*='breadcrumb']",        // Tout ID contenant 'breadcrumb'  // marche pas soir le formulaire cerfa avec site solon

        // Publicités et promotions
        ".ads",
        ".advertisement",
        ".banner",
        ".promo",
        // Éléments sociaux et interactifs
        ".social-media",
        ".comments",
        ".share-buttons",
        "button",
        "form",
        
        // Scripts et styles
        "script",
        "style",
        "link[rel='stylesheet']",
        
        // Autres éléments non essentiels
        ".cookie-banner",
        ".newsletter-signup",
        ".popup",
        ".modal",

        ".cookie-popup",
        ".cookie-banner",
        ".cookie-notice",
        ".cookie-consent",
        ".consent-popup",
        ".consent-banner",
        ".consent-notice",
        ".privacy-notice",
        ".gdpr-popup",
        ".gdpr-banner",
        ".gdpr-notice",
        "[class*='cookie-']",          // Tous les éléments avec une classe contenant cookie
        "[class*='consent-']",      // Tous les éléments avec une classe contenant consent
      // voir pour add les populated
      ].join(", ");

    for (let attempt = 0; attempt < retryCount; attempt++) {

        try {
          //console.log(`Essaie numéro ${attempt}`)
          // Ajouter un délai entre les requêtes (augmente avec chaque tentative)
          if (attempt > 0) {
            //const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await delay(1000);
          }
    
          const response = await fetch(jinaUrl, {
              method: 'GET',
              headers: {
                "Authorization": `Bearer ${jinaApiKey}`,
                "X-Remove-Selector": removeSelectors,
              },
          });
          //console.log("Response :", response) //svt c'est pauement
          if (response.ok) {
            const rawContent = await response.text();
            console.log("Jina extracted content for link :", url)
            return cleanMarkdownContent(rawContent);  // Nettoyer le contenu avant de le retourner
          }
          
          if (response.status === 429) {
            console.log(`Rate limit atteint, tentative ${attempt + 1}/${retryCount}`);
            continue;
          }

          if (response.status === 402) {
            console.log(`Ils veulent un ajout du paiement`);
            continue;
          }
          
          throw new Error(`Erreur HTTP: ${response.status}`);
          
        } catch (error) {
          if (attempt === retryCount - 1) {
            console.error(`Échec de l'extraction pour ${url} après ${retryCount} tentatives`);
            return "Contenu non disponible - Erreur de rate limit";
          }
        }
      }
    return "Contenu non disponible";
}
  
export async function googleSearch(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  const SEARCH_ENGINE_ID = 'e42df805a66ad4b8e';
  
  
  if (!API_KEY) {
    throw new Error('NEXT_PUBLIC_GOOGLE_API_KEY non définie dans .env.local');
  }
  
  const excludedFileTypes = [
    'pdf',
    'xml'
  ];

  const excludedExtensionsPattern = new RegExp(
    `\\.(${excludedFileTypes.join('|')})([?#].*)?$`,
    'i'
  );

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.append('key', API_KEY);
  url.searchParams.append('cx', SEARCH_ENGINE_ID);
  url.searchParams.append('q', query);
  url.searchParams.append('num', maxResults.toString());

  try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
      }

      
      const data: GoogleSearchResponse = await response.json();
      //const limitedItems = data.items.slice(0, maxResults);
      const filteredItems = data.items
      .filter(item => !excludedExtensionsPattern.test(item.link)) //CONTROLER QUE excludedExtensionsPattern fonctionne bien 
      .slice(0, maxResults);
      // Créer un tableau de promesses pour l'extraction parallèle du contenu
      const contentPromises = filteredItems.map(async (item, index) => {
          try {
              // Ajouter un petit délai progressif pour éviter de surcharger l'API
              //await delay(index * 200); // Délai progressif de 200ms entre chaque requête
              
              const content = await extractContentWithJina(item.link);
              return {
                  title: item.title,
                  link: item.link,
                  content: content,
                  similarity_score: 0,
                  publishedDate: extractGooglePublishedDate(item)
              };
          } catch (error) {
              console.error(`Erreur lors de l'extraction pour ${item.link}:`, error);
              // Retourner un résultat avec un message d'erreur plutôt que de faire échouer toute l'opération
              return {
                  title: item.title,
                  link: item.link,
                  content: "Erreur lors de l'extraction du contenu",
                  similarity_score: 0,
                  publishedDate: extractGooglePublishedDate(item)
              };
          }
      });

      // Exécuter toutes les promesses en parallèle
      const results = await Promise.all(contentPromises);
      
      return results.filter(result => result.content !== "Erreur lors de l'extraction du contenu");
      
  } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      throw error;
  }
}
  
  // Fonction utilitaire pour limiter la longueur du contenu si nécessaire
function truncateContent(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
}

export async function googleSearchWithReranking(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
        console.log("[WebSearch] Query :", query)
        // 1. Obtenir les résultats de recherche initiaux
        const initialResults = await googleSearch(query, maxResults);
        // 2. Préparer les contenus pour le reranking
        let contents = initialResults.map(result => result.content);
        /*const embeddingsList:any = await createEmbeddings(contents) // Fait un embedding des différents sites // Voir pour faire un BM25 + Hybrid sur les sites internet
        console.log("embeddingsList: ", embeddingsList)*/
        const res = await estimateTokenCount(contents)
        if (res !== -1)
        {
          console.log("Website slice at :", res)
          contents = contents.slice(0, res)
        }
        // 3. Obtenir les scores et indices de reranking
        const rerankedResults: any = await rerankWithVoyageAIMultiLangual(query, contents);
        console.log("rerankedResults :",rerankedResults);

        // 4. Créer un nouveau tableau de résultats avec les scores
        const resultsWithScores = initialResults.map((result, index) => {
          const rankData = rerankedResults.data.find((d: any) => d.index === index);
          return {
              ...result,
              similarity_score: rankData?.relevance_score ?? 0
          };});

                /* Pourra la remettre j'avais commenté pour qu'il m'imprime dans la console les resultats transmis
      // 5. Filtrer les résultats avec un score > 0.5 et limiter à 2 résultats
      return resultsWithScores
        .filter(result => result.similarity_score > 0.5)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 2);*/

        // Trier par score de similarité
        const sortedResults = resultsWithScores
        .sort((a, b) => b.similarity_score - a.similarity_score);

        let finalResults: SearchResult[] = [];
        let totalEstimatedTokens = 0;
        const TOKEN_LIMIT = 100000;

        for (const result of sortedResults) {
          // On vérifie d'abord le score de similarité
          if (result.similarity_score >= 0.5) {
              const estimatedTokens = Math.ceil(result.content.length / 6);
              if (totalEstimatedTokens + estimatedTokens <= TOKEN_LIMIT && finalResults.length < 6) {
                  totalEstimatedTokens += estimatedTokens;
                  finalResults.push(result);
                  //console.log(`Added source ${finalResults.length}, estimated tokens: ${estimatedTokens}, total: ${totalEstimatedTokens}`);
              } else {
                  break;
              }
          }
        }
       /* finalResults.forEach((result, index) => {
          console.log(`--- Page ${index + 1} ---`);
          console.log(`Score: ${result.similarity_score.toFixed(3)}`);
          console.log(`URL: ${result.link}`);
          console.log(`Titre: ${result.title}`);
          console.log(`Contenu: ${result.content}`);
          console.log("------------------------");
        });*/
//        console.log(`Final sources: ${finalResults.length}, estimated total tokens: ${totalEstimatedTokens}`);
        return finalResults;

      } catch (error) {
      console.error('Erreur lors de la recherche avec reranking:', error);
      throw error;
      }
}

async function estimateTokenCount(strings: string[]): Promise<number> {
  const TOKEN_LIMIT = 150000;
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

async function createEmbeddings(stringList: string[])
{
  try {
      const embeddings: any[] = [];
      
      for (const text of stringList) {
          // Attendre la résolution de chaque embedding
          const embedding:any = await embeddingWithVoyageLaw(text);
          //console.log("Embedding du contenu :", embedding.data[0].embedding)
          embeddings.push(embedding.data[0].embedding);
      }
      
      return embeddings;
  } catch (error: any) {
      throw new Error(`Erreur lors de la création des embeddings: ${error.message}`);
  }
};

/* VERSION WITH BALISES ENTRE LIENS

export async function googleSearch(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  const API_KEY = 'AIzaSyChV3Posl9GrryGA6iAyVELbt7lKBmDy6s';
  const SEARCH_ENGINE_ID = 'e42df805a66ad4b8e';
  
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.append('key', API_KEY);
  url.searchParams.append('cx', SEARCH_ENGINE_ID);
  url.searchParams.append('q', query);
  url.searchParams.append('num', maxResults.toString());

  try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data: GoogleSearchResponse = await response.json();
      const limitedItems = data.items.slice(0, maxResults);
      
const contentPromises = limitedItems.map(async (item, index) => {
        try {
            await delay(index * 200);
            const content = await extractContentWithJina(item.link);            
            const taggedContent = `
<source_of_${item.title}>
URL: ${item.link}
TITRE: ${item.title}
DATE: ${extractGooglePublishedDate(item) || 'Non disponible'}
CONTENU:
${content}
</source_of_${item.title}>
`;
            
            return {
                title: item.title,
                link: item.link,
                content: taggedContent,
                similarity_score: 0,
                publishedDate: extractGooglePublishedDate(item)
            };
        } catch (error) {
            console.error(`Erreur lors de l'extraction pour ${item.link}:`, error);
            return {
                title: item.title,
                link: item.link,
                content: `<source_${index + 1}>ERREUR: Contenu non disponible</source_${index + 1}>`,
                similarity_score: 0,
                publishedDate: extractGooglePublishedDate(item)
            };
        }
    });

      // Exécuter toutes les promesses en parallèle
      const results = await Promise.all(contentPromises);
      
      return results.filter(result => result.content !== "Erreur lors de l'extraction du contenu");
      
  } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      throw error;
  }
}
*/