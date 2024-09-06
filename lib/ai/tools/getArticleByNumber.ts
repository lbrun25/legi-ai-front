import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getArticle} from "@/lib/supabase/searchArticles";

export const getArticleByNumber = tool(async (input) => {
  if (!input) return "";
  try {
    const articleSource = input.source.charAt(0).toUpperCase() + input.source.slice(1).toLowerCase();
    const articleResponse = await getArticle(articleSource, input.number);
    return `Article ${articleResponse.number}: ${articleResponse.content}`;
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return "";
  }
}, {
  name: 'getArticleByNumber',
  description: "Obtient le contenu d'un article simplement avec sa source et son numéro",
  schema: z.object({
    source: z.string().describe("La source à laquelle l'article appartient. Exemple: Code civil"),
    number: z.string().describe("Le numéro de l'article")
  })
})
