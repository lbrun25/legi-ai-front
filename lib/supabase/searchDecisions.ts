"use server"
import {embeddingWithVoyageLawForDecisions} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {OpenAI} from "openai";
import postgres from 'postgres';
import {sql} from "@/lib/sql/client";

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

  const formattedEmbedding = `[${embedding.join(',')}]`;  // assuming halfvec is formatted like an array

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        // Dynamically construct the function name
        const functionName = `match_decisions_test_part_${partitionIndex}_adaptive`;

        // Pass formatted embedding as a halfvec (assuming embedding needs to be passed as a string or formatted vector)
        const query = sql.unsafe(`
          SELECT * FROM ${functionName}($1::halfvec, $2::int)
        `, [formattedEmbedding, matchCount]);

        // Execute the query and get the results
        const matchedDecisions = await query;

        if (matchedDecisions) {
          // Assuming matchedDecisions has the structure you expect
          return matchedDecisions;
        } else {
          return [];
        }
      } catch (err: any) {
        console.error(`Error fetching decisions from partition ${partitionIndex}:`, err);

        // Handle timeout or other database-related errors
        if (err.code === "57014") {  // 57014 is a PostgreSQL code for statement timeout
          hasTimedOut = true;
        }
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
  } finally {
    // Close the connection after all queries are complete
    // await sql.end();
  }

  return {
    decisions: allDecisions,
    hasTimedOut: hasTimedOut,
  };
};

const fetchDecisionsFromIds = async (embedding: number[], idList: bigint[], matchCount: number): Promise<FetchDecisionsFromIdsResponse> => {
  // console.log('Will call match_decisions_by_ids with IDs:', idList);
  try {
    // Convert embedding to the PostgreSQL compatible halfvec format
    const formattedEmbedding = `[${embedding.join(',')}]`; // Assuming halfvec format

    // Execute the query directly
    const query = sql.unsafe(`
      SELECT * FROM search_match_decisions_by_ids_full_content($1, $2, $3, $4)
    `, [formattedEmbedding, 0.2, matchCount, idList]);

    // Fetch matched decisions
    const matchedDecisions = await query as unknown as MatchedDecision[];
    console.log('matchedDecisions:', matchedDecisions)

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

  const maxIndex = 9;
  const matchCountID = 10; // nombre d'idi a retourner

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
    console.log(`topDecisions:`, decisionsFromIdsResponse.decisions.map((m: MatchedDecision) => JSON.stringify({ id: m.id, number: m.number, date: m.date, juridiction: m.juridiction, similarity: m.similarity })));
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
