import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getArticlesByIds, searchMatchedArticles} from "@/lib/supabase/searchArticles";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";

const NUM_RELEVANT_CHUNKS = 150;

export const getMatchedArticlesTool = tool(async (input) => {
  return getMatchedArticles(input);
}, {
  name: 'getMatchedArticles',
  description: "Obtient les articles les plus similaires basée sur la rêquete de l'utilisateur",
  schema: z.object({
    query: z.string().describe("Il est impératif de mentionner le nom du code entre crochets ([]) au début de la requête, suivi de termes juridiques précis et pertinents. Exemple : [Nom du code] terme1 terme2 ..."),
  })
})

export async function getMatchedArticles(input: any)
{
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
  console.log('Nb bm25Results articles:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.65, 0.35);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  console.log("RANKFUSION articles: ", rankFusionIds);

  const articlesToRank = await getArticlesByIds(rankFusionIds, semanticResponse.codeName);
  if (!articlesToRank) return "";
  const articlesContentToRank = articlesToRank?.map((article) => article.content as string);
  if (!articlesContentToRank) return "";
  const articlesRanked = await rerankWithVoyageAI(input, articlesContentToRank);
  if (!articlesRanked) {
    const formattedArticles = articlesToRank.map((article) => `\n• Article ${article.number} : "${article.content}"`).join("\n");
    return `${codeName}:\n${formattedArticles}`;
  }

  const filteredRankFusionIds = articlesToRank.map((_, i) => {
    const index = articlesRanked.data[i].index;
    return rankFusionIds[index];
  });
  const filteredArticlesToRank = articlesToRank.filter(article =>
    filteredRankFusionIds.includes(article.id)
  );
  const formattedArticles = filteredArticlesToRank.map((article) => `\n• Article ${article.number} : "${article.content}"`).join("\n");
  return `${codeName}:\n${formattedArticles}`;
}
