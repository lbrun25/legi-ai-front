"use server"
import {supabaseClient} from "./supabaseClient";
import {OpenAI} from "openai";
import {Article} from "@/lib/types/article";

export interface MatchedArticle {
  id: bigint;
  content: string;
  number: string;
  similarity: number;
}

export interface SearchMatchedArticlesResponse {
  articles: MatchedArticle[];
  hasTimedOut: boolean;
  codeName: string;
}

interface FetchArticlesResponse {
  articles: MatchedArticle[];
  hasTimedOut: boolean;
}

const fetchArticles = async (embedding: number[], matchCount: number, codeTitle: string): Promise<FetchArticlesResponse> => {
    try {
      console.time(`call articles from ${codeTitle}`);
      const { data: matchedArticles, error } = await supabaseClient.rpc(`match_articles_${codeTitle}_adaptive`, {
        query_embedding: embedding,
        match_count: matchCount,
      });
      console.timeEnd(`call articles from ${codeTitle}`);
      if (error) {
        console.error(`Error in table ${codeTitle}`, error);
        // canceling statement due to statement timeout
        if (error.code === "57014") {
          return {
            articles: [],
            hasTimedOut: true,
          }
        }
        return {
          articles: [],
          hasTimedOut: false,
        }
      }
      return {
        articles: matchedArticles,
        hasTimedOut: false,
      };
    } catch (err) {
      console.error(`Exception occurred in table ${codeTitle}`, err);
      return {
        articles: [],
        hasTimedOut: false,
      }
    }
};

const fetchArticlesFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number, codeTitle: string) => {
  const allArticles: MatchedArticle[] = [];
  const promises: any[] = [];
  let hasTimedOut = false;

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        console.time(`call articles from ${codeTitle} partition ${partitionIndex}`);
        const { data: matchedArticles, error } = await supabaseClient.rpc(`match_articles_${codeTitle}_part_${partitionIndex}_adaptive`, {
          query_embedding: embedding,
          match_count: matchCount,
        });

        if (error) {
          console.error(`Error fetching articles from ${codeTitle} partition ${partitionIndex}:`, error);
          // canceling statement due to statement timeout
          if (error.code === "57014") {
            hasTimedOut = true;
          }
          return [];
        }

        // console.log(`Fetched articles from ${codeTitle} partition ${partitionIndex}:`, matchedArticles.map((m: MatchedArticle) => JSON.stringify({ number: m.number, similarity: m.similarity })));
        console.timeEnd(`call articles from ${codeTitle} partition ${partitionIndex}`);
        return matchedArticles;
      } catch (err) {
        console.error(`Exception occurred for ${codeTitle} partition ${partitionIndex}:`, err);
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

  return {
    articles: allArticles,
    hasTimedOut: hasTimedOut,
  };
}

async function getCodeTitle(input: string): Promise<string> {
  const regex = /\[(.*?)\]/;
  const match = regex.exec(input);

  if (match && match[1]) {
    return match[1]
      .toLowerCase()
      .replace(/\s+/g, '_')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/'/g, '');
  } else {
    console.warn('Error no title of Code found in the query.');
    return '';
  }
}

async function cleanInput(input: string) {
  return input.replace(/\[.*?\]/g, '').replace(/\s\s+/g, ' ').trim();
}

export const searchMatchedArticles = async (input: string): Promise<SearchMatchedArticlesResponse> => {
  console.log('searchMatchedArticles:', input);
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  // OpenAI recommends replacing newlines with spaces for best results
  input = input.replace(/\n/g, ' ');
  const codeTitle = await getCodeTitle(input);
  console.log('Code :', codeTitle);
  input = await cleanInput(input);
  //console.log('searchMatchedArticles:', input);

  const result = await openai.embeddings.create({
    input,
    model: "text-embedding-3-large",
  });
  const [{embedding}] = result.data;

  const maxIndex = 4;
  const matchCount = 5;

  const partitionedTablesByCodeTitle = [
    "code_de_commerce",
    "code_de_la_construction_et_de_lhabitation",
    "code_monétaire_et_financier",
    "code_de_procedure_penale",
    "code_de_la_securite_sociale",
    "code_du_travail"
  ];
  const isCodePartitioned = partitionedTablesByCodeTitle.includes(codeTitle);

  if (isCodePartitioned) {
    try {
      const articlesFromPartitionsResponse = await fetchArticlesFromPartitions(maxIndex, embedding, matchCount, codeTitle);
      const allArticles = articlesFromPartitionsResponse.articles;
      allArticles.sort((a, b) => b.similarity - a.similarity);
      const topArticles = allArticles.slice(0, matchCount);
      return {
        articles: topArticles,
        hasTimedOut: articlesFromPartitionsResponse.hasTimedOut,
        codeName: codeTitle,
      };
    } catch (error) {
      console.error('Error occurred while fetching articles:', error);
      return {
        articles: [],
        hasTimedOut: false,
        codeName: codeTitle,
      };
    }
  }

  try {
    const articlesResponse = await fetchArticles(embedding, matchCount, codeTitle);
    const topArticles = articlesResponse.articles.slice(0, matchCount);
    return {
      articles: topArticles,
      hasTimedOut: articlesResponse.hasTimedOut,
      codeName: codeTitle,
    };
  } catch (err) {
    console.error('Error occurred while fetching articles:', err);
    return {
      articles: [],
      hasTimedOut: false,
      codeName: codeTitle,
    };
  }
}

export const getArticle = async (source: string, number: string): Promise<Article> => {
  const {data, error} = await supabaseClient
    .from("articles_large")
    .select('content, url, source, number, context, startDate, endDate, isRepealed')
    .eq('number', number)
    .eq('source', source)
    .single();
  if (error)
    throw new Error(`Error retrieving article from Supabase: ${error}`);
  if (!data)
    throw new Error("no article found");
  return data;
}
