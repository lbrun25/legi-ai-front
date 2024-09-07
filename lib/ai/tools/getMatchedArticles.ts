import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedArticle, searchMatchedArticles} from "@/lib/supabase/searchArticles";

export const getMatchedArticles = tool(async (input) => {
  if (!input.query) return "";
  const matchedArticlesResponse = await searchMatchedArticles(input.query);
  if (matchedArticlesResponse.hasTimedOut) return "";
  return "#" + matchedArticlesResponse.articles?.map((article: MatchedArticle) => `Article ${article.number}: ${article.content}`).join("#");
}, {
  name: 'getMatchedArticles',
  description: "Obtient les articles les plus similaires basée sur la rêquete de l'utilisateur",
  schema: z.object({
    query: z.string().describe("Il est impératif de mentionner le nom du code entre crochets ([]) au début de la requête, suivi de termes juridiques précis et pertinents. Exemple : [Nom du code] terme1 terme2 ..."),
  })
})
