import {supabaseClient} from "./supabaseClient";
import {OpenAI} from "openai";

export interface MatchedArticle {
  id: bigint;
  content: string;
  number: string;
  similarity: number;
}

export interface SearchMatchedArticlesResponse {
  articles: MatchedArticle[];
}

export const searchMatchedArticles = async (input: string): Promise<SearchMatchedArticlesResponse> => {
  console.log('searchMatchedArticles:', input);
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  // OpenAI recommends replacing newlines with spaces for best results
  input = input.replace(/\n/g, ' ')
  // Generate a one-time embedding for the query itself
  const result = await openai.embeddings.create({
    input,
    model: "text-embedding-3-small",
  });
  const [{embedding}] = result.data;
  const {data: matchedArticles, error} = await supabaseClient.rpc('match_articles_light', {
    query_embedding: embedding,
    match_threshold: 0.6,
    match_count: 10,
  });
  if (error) {
    console.error("cannot search matched articles:", error);
  }
  return {
    articles: matchedArticles
  };
}
