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

const fetchArticlesFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number) => {
  const allArticles: MatchedArticle[] = [];
  const promises: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        const { data: matchedArticles, error } = await supabaseClient.rpc(`match_articles_light`, {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: matchCount,
          partition_index: partitionIndex
        });

        if (error) {
          console.error(`Error fetching articles from partition ${partitionIndex}:`, error);
          return [];
        }

        console.log(`Fetched articles from partition ${partitionIndex}:`, matchedArticles.map((m: MatchedArticle) => JSON.stringify({ number: m.number, similarity: m.similarity })));
        return matchedArticles;
      } catch (err) {
        console.error(`Exception occurred for partition ${partitionIndex}:`, err);
        return [];
      }
    })();

    promises.push(promise);
  }

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      } else {
        if ("reason" in result) {
          console.error('A promise was rejected:', result.reason);
        }
      }
    });
  } catch (err) {
    console.error('Unexpected error occurred while fetching articles from partitions:', err);
  }

  return allArticles;
};

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
  const matchCount = 5;

  try {
    const allArticles = await fetchArticlesFromPartitions(maxIndex, embedding, matchCount);
    allArticles.sort((a, b) => b.similarity - a.similarity);
    const topArticles = allArticles.slice(0, matchCount);
    console.log("got matched articles:", topArticles);
    return {
      articles: topArticles
    };
  } catch (err) {
    console.error('Error occurred while fetching articles:', err);
    return {
      articles: []
    };
  }
}
