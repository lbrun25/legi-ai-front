"use server"
import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {OpenAI} from "openai";

export interface MatchedDoctrine {
  id: bigint;
  paragrapheContent: string;
  paragrapheNumber: string;
  similarity: number;
}

export interface SearchMatchedDoctrinesResponse {
  doctrines: MatchedDoctrine[];
}

const fetchDoctrinesFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number) => {
  const allDoctrines: MatchedDoctrine[] = [];
  const promises: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        const { data: matchedDoctrines, error } = await supabaseClient.rpc(`match_doctrines_part_${partitionIndex}_adaptive`, {
          query_embedding: embedding,
          match_count: matchCount,
        });

        if (error) {
          console.error(`Error fetching doctrines from partition ${partitionIndex}:`, error);
          return [];
        }

        console.log(`Fetched doctrines from partition ${partitionIndex}:`, matchedDoctrines.map((m: MatchedDoctrine) => JSON.stringify({ number: m.paragrapheNumber, similarity: m.similarity })));
        return matchedDoctrines;
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
        allDoctrines.push(...result.value);
      } else {
        if ("reason" in result) {
          console.error('A promise was rejected:', result.reason);
        }
      }
    });
  } catch (err) {
    console.error('Unexpected error occurred while fetching doctrines from partitions:', err);
  }

  return allDoctrines;
};

const fetchDoctrinesFromIds = async (embedding: number[], idList: bigint[], matchCount: number) => {
  console.log('Will call match_doctrines_by_ids with IDs:', idList);
  try {
    console.time('call match_doctrines_by_ids')
    const { data: matchedDoctrines, error } = await supabaseClient.rpc(`match_doctrines_by_ids`, {
      query_embedding: embedding,
      match_threshold: 0.2,
      match_count: matchCount,
      id_list: idList,
    });
    console.timeEnd('call match_doctrines_by_ids');
    if (error) {
      console.error(`Error fetching doctrines from indexes:`, error);
      return [];
    }
    return matchedDoctrines;
  } catch (error) {
    console.error(`Exception occurred when fetching doctrines from indexes:`, error);
    return [];
  }
};

export const searchMatchedDoctrines = async (input: string): Promise<SearchMatchedDoctrinesResponse> => {
  console.log('searchMatchedDoctrines:', input);
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      doctrines: []
    }
  }
  const embedding_Voyage = response.data[0].embedding;
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  const result = await openai.embeddings.create({
    input,
    model: "text-embedding-3-large",
  });
  const [{embedding: embeddingOpenai}] = result.data;

  const maxIndex = 2;
  const matchCount = 5;

  try {
    const allDoctrines = await fetchDoctrinesFromPartitions(maxIndex, embeddingOpenai, matchCount);
    const doctrineIds: bigint[] = allDoctrines.map((doctrine: MatchedDoctrine) => doctrine.id);
    const topDoctrines = await fetchDoctrinesFromIds(embedding_Voyage, doctrineIds, matchCount);
    console.log(`topDoctrines:`, topDoctrines.map((m: MatchedDoctrine) => JSON.stringify({ id: m.id, number: m.paragrapheNumber, similarity: m.similarity })));
    return {
      doctrines: topDoctrines
    };
  } catch (err) {
    console.error('Error occurred while fetching doctrines:', err);
    return {
      doctrines: []
    };
  }
}
