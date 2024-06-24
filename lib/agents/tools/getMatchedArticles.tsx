import {ToolProps} from "@/lib/agents/tools/index";
import {tool} from "ai";
import {z} from "zod";
import {createStreamableValue} from "ai/rsc";
import {MatchedArticle, searchMatchedArticles} from "@/lib/supabase/searchArticles";
import {SearchSkeleton} from "@/components/search-skeleton";

export const getMatchedArticlesTool = ({uiStream, fullResponse}: ToolProps) => tool({
  description: "Obtient les articles les plus similaires à la demande de l'utilisateur",
  parameters: z.object({
    query: z.string().describe("La description du problème que l'utilisateur tente de résoudre"),
  }),
  execute: async ({query}) => {
    const streamResults = createStreamableValue<string>()
    // Append the search section
    uiStream.append(<SearchSkeleton/>)

    if (query.length === 0) {
      console.error("cannot getMatchedArticles: input is empty");
      uiStream.update(null)
      streamResults.done()
      return;
    }
    const matchedArticlesResponse: any = await searchMatchedArticles(query);
    console.log('matchedArticlesResponse:', matchedArticlesResponse);
    uiStream.update(null)
    return "#" + matchedArticlesResponse.map((article: MatchedArticle) => `Article ${article.number}: ${article.content}`).join("#");
  }
})
