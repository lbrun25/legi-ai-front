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

const fetchArticlesFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number, codeTitle: string) => {
    try {
      //console.log("Code appelé :",codeTitle)
      console.time('call articles');
      const { data: matchedArticles, error } = await supabaseClient.rpc(`match_articles_${codeTitle}`, {
        query_embedding: embedding,
        match_count: matchCount,
      });
      console.timeEnd('call articles');
      if (error) {
        console.error(`Error in table ${codeTitle}`, error);
        return [];
      }
      return matchedArticles;
    } catch (err) {
      console.error(`Exception occurred in table ${codeTitle}`, err);
      return [];
    }
};

async function getCodeTitle(input: string): Promise<string> {
  const regex = /\[(.*?)\]/;
  const match = regex.exec(input);

  if (match && match[1]) {
    const formattedString = match[1]
      .toLowerCase()
      .replace(/\s+/g, '_')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/'/g, '');

    return formattedString;
  } else {
    console.log('Error no title of Code found in the query !');
    return '';
  }
}

async function cleanInput(input: string) {
  return input.replace(/\[.*?\]/g, '').replace(/\s\s+/g, ' ').trim();
}

export const searchMatchedArticles = async (input: string): Promise<SearchMatchedArticlesResponse> => {
  //console.log('searchMatchedArticles:', input);
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  // OpenAI recommends replacing newlines with spaces for best results
  input = input.replace(/\n/g, ' ');
  const codeTitle = await getCodeTitle(input);
  console.log('Code :', codeTitle);
  input = await cleanInput(input);
  console.log('searchMatchedArticles:', input);

  const result = await openai.embeddings.create({
    input,
    model: "text-embedding-3-large",
  });
  const [{embedding}] = result.data;

  const maxIndex = 4;
  const matchCount = 5;

  try {
    const allArticles = await fetchArticlesFromPartitions(maxIndex, embedding, matchCount, codeTitle);
    const topArticles = allArticles.slice(0, matchCount);
    //console.log("got matched articles:", topArticles);
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
