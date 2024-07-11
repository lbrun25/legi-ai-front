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

  const maxIndex = 4;
  const matchThreshold = 0.5;
  const matchCount = 10;

  const allArticles: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    try {
      const { data: matchedArticles, error } = await supabaseClient.rpc('match_articles_light', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        partition_index: partitionIndex,
      });
      if (error) {
        console.error(`Error fetching from partition ${partitionIndex}:`, error);
        continue;
      }
      console.log(`Fetched articles from partition ${partitionIndex}:`, matchedArticles.map((m: MatchedArticle) => JSON.stringify({number: m.number, similarity: m.similarity})));
      if (matchedArticles) {
        allArticles.push(...matchedArticles);
      }
    } catch (err) {
      console.error(`Exception occurred for partition ${partitionIndex}:`, err);
    }
  }
  allArticles.sort((a, b) => b.similarity - a.similarity);
  const topArticles = allArticles.slice(0, matchCount);

  console.log("got matched articles:", topArticles);
  return {
    articles: topArticles
  };
}
