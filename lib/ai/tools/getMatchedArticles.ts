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
  const bm25Ids = bm25Results.map((article: any) => article.id);
  //console.log('Nb bm25Results articles:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 15, 0.65, 0.35);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  //console.log("RANKFUSION articles: ", rankFusionIds);
  const articlesToRank = await getArticlesByIds(rankFusionIds, semanticResponse.codeName);
  if (!articlesToRank) return "";
  const articlesContentToRank = articlesToRank?.map((article) => article.content as string);
  if (!articlesContentToRank) return "";
  const articlesRanked: any = await rerankWithVoyageAI(input, articlesContentToRank);
  const filteredArticles: any = articlesRanked.data.filter((Article: ArticlePrecision) => Article.relevance_score >= 0.5);
  console.log('RerankerArticles :', filteredArticles)
  if (!articlesRanked) {
    return convertArticlesToXML(codeName, articlesToRank);
  }

  const filteredRankFusionIds = articlesToRank.map((_, i) => {
    const index = articlesRanked.data[i].index;
    return rankFusionIds[index];
  });
  const filteredArticlesToRank = articlesToRank.filter(article =>
    filteredRankFusionIds.includes(article.id)
  );
  return convertArticlesToXML(semanticResponse.codeName, filteredArticlesToRank);
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
