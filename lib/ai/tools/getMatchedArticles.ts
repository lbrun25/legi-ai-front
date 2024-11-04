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
  console.log("[getMatchedArticlesTool] Query :", input.query)
  return resultArticles(input.query);
}, {
  name: 'getMatchedArticles',
  description: "Obtient les articles les plus similaires basée sur la rêquete de l'utilisateur",
  schema: z.object({
    query: z.string().describe("Il est impératif de mentionner le nom du code entre crochets ([]) au début de la requête, suivi de termes juridiques précis et pertinents. Exemple : [Nom du code] terme1 terme2 ..."),
  })
})

async function resultArticles(input: any){
  if (!input) return "";
  console.log('[Article Input] : ', input);
  const semanticResponse = await searchMatchedArticles(input);
  if (semanticResponse.hasTimedOut) return "";
  const codeNameMatch = input.match(/\[([^\]]+)\]/);
  const codeName = codeNameMatch ? codeNameMatch[1] : semanticResponse.codeName;
  const bm25Results = await ElasticsearchClient.searchArticles(semanticResponse.codeName, input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.articles.length === 0 || bm25Results.length === 0)
    return "";
  const semanticIds = semanticResponse.articles.map((article) => article.id);
  const bm25Ids = bm25Results.map((article: any) => article.id);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 80, 0.5, 0.5);
  const listIDs = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  const codeName2 = getCodeName(codeName)
  const articlesToRank = await getArticlesByIds(listIDs, codeName2);
  const articlesContent = articlesToRank?.map(article => article.content) || [];
  if (!articlesToRank) return "";
  const articlesRanked: any = await rerankWithVoyageAI(input, articlesContent);
  //console.log("articlesRanked", articlesRanked)
  const filteredArticles: any = articlesRanked.data.filter((Article: ArticlePrecision) => Article.relevance_score >= 0.4);
  const indexes = filteredArticles.map((Article: ArticlePrecision) => Article.index).reverse();
  const orderedArticles = indexes.map((index: any) => articlesToRank[index]);
  //console.log("orderedArticles :", orderedArticles);
  if (!orderedArticles) return "Aucun article pertinent n'a été trouvé.";
  console.log("return :", convertArticlesToXML(codeName, orderedArticles))
  return convertArticlesToXML(codeName, orderedArticles);
}

export async function getMatchedArticles(input: any) {
  if (!input) return "";
  //input = "[Code de Commerce]" + input
  console.log('[Article Input] : ', input);
  const semanticResponse = await searchMatchedArticles(input);
  if (semanticResponse.hasTimedOut) return "";
  const codeNameMatch = input.match(/\[([^\]]+)\]/);
  const codeName = codeNameMatch ? codeNameMatch[1] : semanticResponse.codeName;

  const bm25Results = await ElasticsearchClient.searchArticles(semanticResponse.codeName, input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.articles.length === 0 || bm25Results.length === 0)
    return "";

  const semanticIds = semanticResponse.articles.map((article) => article.id);
  //console.log("inputs :", input)
  //console.log('Nb semantic articles:', semanticIds);
  const bm25Ids = bm25Results.map((article: any) => article.id);
  //console.log("inputs :", input)
  //console.log('Nb bm25Results articles:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 80, 0.5, 0.5);
  const listIDs = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  console.log("[Articles] RankFusion :", listIDs);
  //const listIDs = rankFusionIds.slice(0, 10);
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

export async function articlesCleaned(code: string, rankFusionIds: bigint[], input: string) {
  if (!code) return ""
  //console.log(`For ${code}, list ids : [${rankFusionIds}]`)
  const codeName = getCodeName(code)
  const articlesToRank = await getArticlesByIds(rankFusionIds, codeName);
  const articlesContent = articlesToRank?.map(article => article.content) || [];
  if (!articlesToRank) return "";
  const articlesRanked: any = await rerankWithVoyageAI(input, articlesContent); //A voir si on vire le reranlr quand ça passe apres doctrine et on garde quand ça passe pas par la doctrine avant aussi actuellement c'est sur summary l'input il faut modifier pour mettre sur le contenu de l'article
  //console.log("index :", articlesRanked)
  const filteredArticles: any = articlesRanked.data.filter((Article: ArticlePrecision) => Article.relevance_score >= 0.4);
  const index = filteredArticles.map((Article: ArticlePrecision) => Article.index);
  //console.log("index :", index)
  const test = index.map((index: any) => articlesToRank[index].id);
  console.log("Code :", codeName)
  console.log("id :", test.slice(0,10))
  const indexes = filteredArticles.map((Article: ArticlePrecision) => Article.index);
  //console.log(indexes);
  const orderedArticles = [];
  for (let i = 0; i < filteredArticles.length && i < 10; i++) {
      const index = indexes[i];
      //console.log("articlesToRank[index] : ", articlesToRank[index])
      orderedArticles.push(articlesToRank[index]);
  }
  //console.log("orderedArticles :", orderedArticles.length);
  if (orderedArticles.length === 0) return "Aucun article pertinent n'a été trouvé.";
  /*const filteredArticlesToRank = articlesToRank.filter(article =>
    rankFusionIds.includes(article.id)
  );*/
  return convertArticlesToXML(codeName, orderedArticles);
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
