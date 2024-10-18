"use server"
import {supabaseClient} from "./supabaseClient";
import {OpenAI} from "openai";
import {Article} from "@/lib/types/article";
import {sql} from "@/lib/sql/client";

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

// Record <Supabase table name, code title returned by the assistant>
const ARTICLE_TABLE_NAMES: Record<string, string> = {
  "articles_code_assurances": "articles_code_assurances",
  "articles_code_civil": "articles_code_civil",
  "articles_code_commerce": "articles_code_de_commerce",
  "articles_code_consommation": "articles_code_de_la_consommation",
  "articles_code_construction_habitation": "articles_code_de_la_construction_et_de_lhabitation",
  "articles_code_monetaire_financier": "articles_code_monetaire_et_financier",
  "articles_code_penal": "articles_code_penal",
  "articles_code_procedure_civile": "articles_code_de_procedure_civile",
  "articles_code_procedure_civiles_execution": "articles_code_des_procedure_civiles_dexecution",
  "articles_code_procedure_penale": "articles_code_de_procedure_penale",
  "articles_code_propriete_intellectuelle": "articles_code_de_la_propriete_intellectuelle",
  "articles_code_securite_sociale": "articles_code_de_la_securite_sociale",
  "articles_code_travail": "articles_code_du_travail",
};

const fetchArticles = async (embedding: number[], matchCount: number, codeTitle: string): Promise<FetchArticlesResponse> => {
    try {
      console.time(`call articles from ${codeTitle}`);
      const formattedEmbedding = `[${embedding.join(',')}]`;
      const functionName = `match_articles_${codeTitle}_adaptive`;

      const query = sql.unsafe(`
          SELECT * FROM ${functionName}($1::halfvec, $2::int)
        `, [formattedEmbedding, matchCount]);

      const matchedArticles = await query as unknown as MatchedArticle[];
      console.timeEnd(`call articles from ${codeTitle}`);

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

  const formattedEmbedding = `[${embedding.join(',')}]`;

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        console.time(`call articles from ${codeTitle} partition ${partitionIndex}`);
        const functionName = `match_articles_${codeTitle}_part_${partitionIndex}_adaptive`;

        const query = sql.unsafe(`
          SELECT * FROM ${functionName}($1::halfvec, $2::int)
        `, [formattedEmbedding, matchCount]);

        const matchedArticles = await query as unknown as MatchedArticle[];
        // console.log(`Fetched articles from ${codeTitle} partition ${partitionIndex}:`, matchedArticles.map((m: MatchedArticle) => JSON.stringify({ number: m.number, similarity: m.similarity })));
        console.timeEnd(`call articles from ${codeTitle} partition ${partitionIndex}`);

        if (matchedArticles) {
          return matchedArticles;
        } else {
          return [];
        }
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

  const matchCount = 150;
  const partitionedTablesByCodeTitle = [
    "code_de_commerce",
    "code_de_la_construction_et_de_lhabitation",
    "code_monétaire_et_financier",
    "code_de_procedure_penale",
    "code_de_la_securite_sociale",
    "code_du_travail"
  ];
  const maxIndexByCodeTitle: Record<string, number> = {
    "code_de_commerce": 2,
    "code_de_la_construction_et_de_lhabitation": 2,
    "code_monétaire_et_financier": 2,
    "code_de_procedure_penale": 2,
    "code_de_la_securite_sociale": 2,
    "code_du_travail": 4
  };

  const isCodePartitioned = partitionedTablesByCodeTitle.includes(codeTitle);

  if (isCodePartitioned) {
    try {
      const maxIndex = maxIndexByCodeTitle[codeTitle];
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

export async function getArticlesByIds(articleIds: bigint[], codeName: string) {
  const tableName = Object.keys(ARTICLE_TABLE_NAMES).find(key => ARTICLE_TABLE_NAMES[key] === `articles_${codeName}`);
  //console.log("tableName", tableName)
  if (!tableName) {
    console.error(`Corresponding ${codeName} not found`);
    return null;
  }
  const { data, error } = await supabaseClient
    .from(tableName)
    .select('id,content,number')
    .in('id', articleIds);
  if (error) {
    console.error('Error fetching articles:', error);
    return null;
  }
  return data;
}
