"use server"
import {embeddingWithVoyageLawForDecisions} from "@/lib/ai/voyage/embedding";
import {OpenAI} from "openai";
import {sql} from "@/lib/sql/client";
import {supabaseClient} from "@/lib/supabase/supabaseClient";

export interface MatchedDecision {
  id: bigint;
  ficheArret: string;
  number: string;
  date: string;
  juridiction: string;
  decisionLink: string;
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

  const formattedEmbedding = `[${embedding.join(',')}]`;

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        const functionName = `match_decisions_test_part_${partitionIndex}_adaptive`; // match_decisions_test_part_ *** match_decisions_search_part_

        // We don't use supabase client because of timeout
        const query = sql.unsafe(`
          SELECT * FROM ${functionName}($1::halfvec, $2::int)
        `, [formattedEmbedding, matchCount]);

        const matchedDecisions = await query;

        if (matchedDecisions) {
          return matchedDecisions;
        } else {
          return [];
        }
      } catch (err) {
        console.error(`Error fetching decisions from partition ${partitionIndex}:`, err);
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

const fetchDecisionsFromIds = async (embedding: number[], idList: bigint[], matchCount: number): Promise<FetchDecisionsFromIdsResponse> => { //search_match_decisions_by_ids_full_content *** match_decisions_by_ids_full_content
  // console.log('Will call match_decisions_by_ids with IDs:', idList);
  try {
    const formattedEmbedding = `[${embedding.join(',')}]`;
    const formattedIdList = `{${idList.join(',')}}`;

    const query = sql.unsafe(`
      SELECT * FROM match_decisions_by_ids_full_content($1, $2, $3, $4)
    `, [formattedEmbedding, 0.2, matchCount, formattedIdList]);

    const matchedDecisions = await query as unknown as MatchedDecision[];
    //console.log('matchedDecisions:', matchedDecisions)

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

export const searchMatchedDecisions = async (input: string, limit: number = 5): Promise<SearchMatchedDecisionsResponse> => {
  //console.log('searchMatchedDecisions:', input);
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

  const maxIndex = 79;
  const matchCountID = 5; // nombre d'idi a retourner

  try {
    const decisionsFromPartitionsResponse = await fetchDecisionsFromPartitions(maxIndex, embeddingOpenai, matchCountID);
    if (decisionsFromPartitionsResponse.hasTimedOut) {
      return {
        decisions: [],
        hasTimedOut: true,
      }
    }
    const decisionIds: bigint[] = decisionsFromPartitionsResponse.decisions.map((decision) => decision.id);
    const decisionsFromIdsResponse = await fetchDecisionsFromIds(embedding_Voyage, decisionIds, limit);
   // console.log(`topDecisions:`, decisionsFromIdsResponse.decisions.map((m: MatchedDecision) => JSON.stringify({ id: m.id, number: m.number, similarity: m.similarity })));
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

export async function searchDecisionsByIds(ids: bigint[]) {
  const { data, error } = await supabaseClient
    .from("legaldecisions_test")
    .select('id,juridiction,date,number')
    .in('id', ids);
  if (error) {
    console.error('Error fetching decisions:', error);
    return null;
  }
  return data;
}

export async function getFullDecisionsByIds(ids: bigint[]) {
  const { data, error } = await supabaseClient
    .from('legaldecisions_test')
    .select('decisionContent')
    .in('id', ids);
  if (error) {
    console.error('Error fetching articles:', error);
    return null;
  }
  return data;
}
