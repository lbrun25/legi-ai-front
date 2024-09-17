"use server"
import {embeddingWithVoyageLawForDecisions} from "@/lib/ai/voyage/embedding";
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
  hasTimedOut: boolean;
}

interface FetchDecisionsFromPartitionsResponse {
  decisions: Pick<MatchedDecision, "id">[];
  hasTimedOut: boolean;
}

interface FetchDecisionsFromIdsResponse {
  decisions: MatchedDecision[];
  hasTimedOut: boolean;
}

const fetchDecisionsFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number): Promise<FetchDecisionsFromPartitionsResponse> => {
  const allDecisions: MatchedDecision[] = [];
  const promises: any[] = [];
  let hasTimedOut = false;

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        console.time("db decisions partition" + partitionIndex);
        const { data: matchedDecisions, error } = await supabaseClient.rpc(`match_decisions_test_part_${partitionIndex}_adaptive`, {
          query_embedding: embedding,
          match_count: matchCount,
        });

        if (error) {
          console.error(`Error fetching decisions from partition ${partitionIndex}:`, error);
          // canceling statement due to statement timeout
          if (error.code === "57014") {
            hasTimedOut = true;
          }
          return [];
        }

        // console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({ number: m.number, similarity: m.similarity })));
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

  return {
    decisions: allDecisions,
    hasTimedOut: hasTimedOut,
  };
};

const fetchDecisionsFromIds = async (embedding: number[], idList: bigint[], matchCount: number): Promise<FetchDecisionsFromIdsResponse> => {
  // console.log('Will call match_decisions_by_ids with IDs:', idList);
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
      // canceling statement due to statement timeout
      if (error.code === "57014") {
        return {
          decisions: [],
          hasTimedOut: true,
        }
      }
      return {
        decisions: [],
        hasTimedOut: false,
      }
    }
    return {
      decisions: matchedDecisions,
      hasTimedOut: false,
    };
  } catch (error) {
    console.error(`Exception occurred when fetching decisions from indexes:`, error);
    return {
      decisions: [],
      hasTimedOut: false,
    }
  }
};

export const searchMatchedDecisions = async (input: string): Promise<SearchMatchedDecisionsResponse> => {
  console.log('searchMatchedDecisions:', input);
  const response = await embeddingWithVoyageLawForDecisions(input);
  if (!response) {
    return {
      decisions: [],
      hasTimedOut: false,
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

  const maxIndex = 14;
  const matchCount = 5;

  try {
    const decisionsFromPartitionsResponse = await fetchDecisionsFromPartitions(maxIndex, embeddingOpenai, matchCount);
    if (decisionsFromPartitionsResponse.hasTimedOut) {
      return {
        decisions: [],
        hasTimedOut: true,
      }
    }
    const decisionIds: bigint[] = decisionsFromPartitionsResponse.decisions.map((decision) => decision.id);
    const decisionsFromIdsResponse = await fetchDecisionsFromIds(embedding_Voyage, decisionIds, matchCount);
    console.log(`topDecisions:`, decisionsFromIdsResponse.decisions.map((m: MatchedDecision) => JSON.stringify({ id: m.id, number: m.number, similarity: m.similarity })));
    return {
      decisions: decisionsFromIdsResponse.decisions,
      hasTimedOut: decisionsFromIdsResponse.hasTimedOut
    };
  } catch (err) {
    console.error('Error occurred while fetching decisions:', err);
    return {
      decisions: [],
      hasTimedOut: false
    };
  }
}
