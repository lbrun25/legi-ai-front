import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";

export interface MatchedDecision {
  id: bigint;
  fichearret: string;
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
        console.time("db decisions" + partitionIndex);
        const { data: matchedDecisions, error } = await supabaseClient.rpc(`match_decisions`, {
          query_embedding: embedding,
          match_threshold: 0.30,
          match_count: matchCount,
          partition_index: partitionIndex
        });

        if (error) {
          console.error(`Error fetching decisions from partition ${partitionIndex}:`, error);
          return [];
        }

        console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({ number: m.number, similarity: m.similarity })));
        console.timeEnd("db decisions" + partitionIndex);
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

export const searchMatchedDecisions = async (input: string): Promise<SearchMatchedDecisionsResponse> => {
  console.log('searchMatchedDecisions:', input);
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      decisions: []
    }
  }
  const embedding = response.data[0].embedding;

  const maxIndex = 2;
  const matchCount = 5;

  try {
    const allDecisions = await fetchDecisionsFromPartitions(maxIndex, embedding, matchCount);
    allDecisions.sort((a, b) => b.similarity - a.similarity);
    const topDecisions = allDecisions.slice(0, matchCount);
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
