import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getArticlesByIds, searchMatchedArticles} from "@/lib/supabase/searchArticles";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";
import {DOMImplementation, XMLSerializer} from '@xmldom/xmldom';

const NUM_RELEVANT_CHUNKS = 150;

interface ArticlePrecision {
  relevance_score: number;
  index: number;
}

export const getMatchedArticlesTool = tool(async (input) => {
  return getMatchedArticles(input);
}, {
  name: 'getMatchedArticles',
  description: "Obtient les articles les plus similaires basée sur la rêquete de l'utilisateur",
  schema: z.object({
    query: z.string().describe("Il est impératif de mentionner le nom du code entre crochets ([]) au début de la requête, suivi de termes juridiques précis et pertinents. Exemple : [Nom du code] terme1 terme2 ..."),
  })
})

export async function getMatchedArticles(input: any) {
  if (!input) return "";
  const semanticResponse = await searchMatchedArticles(input);
  if (semanticResponse.hasTimedOut) return "";
  const codeNameMatch = input.match(/\[([^\]]+)\]/);
  const codeName = codeNameMatch ? codeNameMatch[1] : semanticResponse.codeName;

  const bm25Results = await ElasticsearchClient.searchArticles(semanticResponse.codeName, input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.articles.length === 0 || bm25Results.length === 0)
    return "";

  const semanticIds = semanticResponse.articles.map((article) => article.id);
  //console.log('Nb semantic articles:', semanticIds);
  const bm25Ids = bm25Results.map((article: any) => article.id);
  //console.log('Nb bm25Results articles:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 80, 0.58, 0.42);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  const listIDs = rankFusionIds.slice(0, 10);
  //console.log("Article list ID for one call", listIDs)
  /*
  const articlesToRank = await getArticlesByIds(rankFusionIds, semanticResponse.codeName);
  if (!articlesToRank) return "";
  const articlesContentToRank = articlesToRank?.map((article) => article.content as string);
  if (!articlesContentToRank) return "";
  const articlesRanked: any = await rerankWithVoyageAI(input, articlesContentToRank);
  //console.log('ReRank articles :', articlesRanked)
  const filteredArticles: any = articlesRanked.data.filter((Article: ArticlePrecision) => Article.relevance_score >= 0.5);
  if (!articlesRanked) {
    return convertArticlesToXML(codeName, articlesToRank);
  }
  const filteredRankFusionIds: bigint[] = []; // Correct type for an array of bigints
  for (let i = 0; i < filteredArticles.length; i++) {
    const index = articlesRanked.data[i].index;
    const id: any = rankFusionIds[index]; // Assurez-vous que `rankFusionIds[index]` est bien convertible en bigint
    filteredRankFusionIds.push(id);
  }  */
  //console.log('RerankerArticles :', filteredArticles)
  //console.log('filteredRankFusionIds :', filteredRankFusionIds)
  return {codeName, listIDs}
}

function getCodeName(input: string): string {
  if (!input) {
    console.warn('Error: no title of Code found in the query.');
    return '';
  }

  return input
    .toLowerCase()
    .replace(/\s+/g, '_')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '');
}

export async function articlesCleaned(code: string, rankFusionIds: bigint[]) {
  if (!code) return ""
  //console.log(`For ${code}, list ids : ${rankFusionIds}`)
  const codeName = getCodeName(code)
  const articlesToRank = await getArticlesByIds(rankFusionIds, codeName);
  if (!articlesToRank) return "";
  const filteredArticlesToRank = articlesToRank.filter(article =>
    rankFusionIds.includes(article.id)
  );
  return convertArticlesToXML(codeName, filteredArticlesToRank);
}

function convertArticlesToXML(codeName: string, articles: { number: string, content: string }[]) {
  const domImplementation = new DOMImplementation();
  const title = `articles_${codeName}`;
  const document = domImplementation.createDocument(null, title, null);
  const rootElement = document.documentElement;
  if (!rootElement) return "";

  articles.forEach(article => {
    // Create <article> element
    const articleElement = document.createElement('article');

    // Create <number> element and set its text content
    const numberElement = document.createElement('number');
    numberElement.textContent = article.number;
    articleElement.appendChild(numberElement);

    // Create <content> element and set its text content
    const contentElement = document.createElement('content');
    contentElement.textContent = article.content;
    articleElement.appendChild(contentElement);

    // Append <article> to the root element
    rootElement.appendChild(articleElement);
  });
  const serializer = new XMLSerializer();
  return serializer.serializeToString(document);
}
