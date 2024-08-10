"use server"

import {ChatCompletionMessageToolCall} from "ai/prompts";
import {getArticle} from "@/lib/supabase/searchArticles";

interface ArticleByNumberToolOutputParams {
  number: string;
  source: string;
}

function decodeParamsInGetArticleByNumber(jsonString: string): ArticleByNumberToolOutputParams | null {
  try {
    const data = JSON.parse(jsonString);
    const res: ArticleByNumberToolOutputParams = {number: "", source: ""};
    if ("source" in data)
      res.source = data.source;
    if ("number" in data)
      res.number = data.number;
    if (!res.number)
      console.error("missing number parameter for getArticleByNumber");
    if (!res.source)
      console.error("missing source parameter for getArticleByNumber");
    if (res.number && res.source)
      return res;
  } catch (error) {
    console.error(`Could not decode getArticleByNumber query: ${error}`);
  }
  return null;
}

export const getArticleByNumberToolOutput = async (params: string, toolCall: ChatCompletionMessageToolCall) => {
  const input = decodeParamsInGetArticleByNumber(params);
  if (!input)
    return {
      tool_call_id: toolCall.id,
      output: ""
    };
  console.log('getArticleByNumber params:', input);
  try {
    const articleSource = input.source.charAt(0).toUpperCase() + input.source.slice(1).toLowerCase();
    const articleResponse = await getArticle(articleSource, input.number);
    const formattedArticle = `Article ${articleResponse.number}: ${articleResponse.content}`;
    console.log('getArticleByNumber tool output:', formattedArticle);
    return {
      tool_call_id: toolCall.id,
      output: formattedArticle,
    }
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return {
      tool_call_id: toolCall.id,
      output: ""
    };
  }
}
