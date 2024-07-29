"use server"
import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {OpenAI} from "openai";

export interface MatchedDecision {
  id: bigint;
  ficheArret: string;
  number: string;
  similarity: number;
}

export interface SearchMatchedDecisionsResponse {
  decisions: MatchedDecision[];
}

const fetchDecisionsFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number) => {
  const allDecisions: MatchedDecision[] = [];
  const promises: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        console.time("db decisions partition" + partitionIndex);
        const { data: matchedDecisions, error } = await supabaseClient.rpc(`match_decisions_part_${partitionIndex}_adaptive`, {
          query_embedding: embedding,
          match_count: matchCount,
        });

        if (error) {
          console.error(`Error fetching decisions from partition ${partitionIndex}:`, error);
          return [];
        }

        console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({ number: m.number, similarity: m.similarity })));
        console.timeEnd("db decisions partition" + partitionIndex);
        return matchedDecisions;
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
        allDecisions.push(...result.value);
      } else {
        if ("reason" in result) {
          console.error('A promise was rejected:', result.reason);
        }
      }
    });
  } catch (err) {
    console.error('Unexpected error occurred while fetching decisions from partitions:', err);
  }

  return allDecisions;
};

const fetchDecisionsFromIds = async (embedding: number[], idList: bigint[], matchCount: number) => {
  console.log('Will call match_decisions_by_ids with IDs:', idList);
  try {
    console.time('call match_decisions_by_ids')
    const { data: matchedDecisions, error } = await supabaseClient.rpc(`match_decisions_by_ids`, {
      query_embedding: embedding,
      match_threshold: 0.2,
      match_count: matchCount,
      id_list: idList,
    });
    console.timeEnd('call match_decisions_by_ids');
    if (error) {
      console.error(`Error fetching decisions from indexes:`, error);
      return [];
    }
    return matchedDecisions;
  } catch (error) {
    console.error(`Exception occurred when fetching decisions from indexes:`, error);
    return [];
  }
};

export const searchMatchedDecisions = async (input: string): Promise<SearchMatchedDecisionsResponse> => {
  console.log('searchMatchedDecisions:', input);
  const response = await embeddingWithVoyageLaw(input);
  if (!response) {
    return {
      decisions: []
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
    const allDecisions = await fetchDecisionsFromPartitions(maxIndex, embeddingOpenai, matchCount);
    const decisionIds: bigint[] = allDecisions.map((decision: MatchedDecision) => decision.id);
    const topDecisions = await fetchDecisionsFromIds(embedding_Voyage, decisionIds, matchCount);
    console.log(`topDecisions:`, topDecisions.map((m: MatchedDecision) => JSON.stringify({ id: m.id, number: m.number, similarity: m.similarity })));
    return {
      decisions: topDecisions
    };
  } catch (err) {
    console.error('Error occurred while fetching decisions:', err);
    return {
      decisions: []
    };
  }
}
