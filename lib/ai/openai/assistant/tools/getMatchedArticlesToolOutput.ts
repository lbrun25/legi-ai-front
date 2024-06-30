import {MatchedArticle, searchMatchedArticles} from "@/lib/supabase/searchArticles";
import {ChatCompletionMessageToolCall} from "ai/prompts";

function decodeQueryInGetMatchedArticles(jsonString: string): string {
  try {
    const data = JSON.parse(jsonString);
    if ("query" in data) {
      return data.query;
    }
  } catch (error) {
    console.error(`Could not decode getMatchedArticles query: ${error}`)
  }
  console.error(`Could not find getMatchedArticles query in parameters`);
  return "";
}

export const getMatchedArticlesToolOutput = async (params: string, toolCall: ChatCompletionMessageToolCall) => {
  const input = decodeQueryInGetMatchedArticles(params);
  if (input.length === 0) {
    console.error("cannot getMatchedArticles: input is empty");
    return {
      tool_call_id: toolCall.id,
      output: ""
    };
  }
  const matchedArticlesResponse = await searchMatchedArticles(input);
  console.log('matchedArticlesResponse:', matchedArticlesResponse);
  const articles = "#" + matchedArticlesResponse.articles?.map((article: MatchedArticle) => `Article ${article.number}: ${article.content}`).join("#");
  console.log('articles:', articles);
  console.log('tool call id:', toolCall.id);
  return {
    tool_call_id: toolCall.id,
    output: articles,
  };
}
