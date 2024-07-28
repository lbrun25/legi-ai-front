"use server"
import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import { Allerta_Stencil } from "next/font/google";
import {OpenAI} from "openai";


export interface MatchedDecision {
  id: bigint;
  ficheArret: string;
  number: string;
  similarity: number;
}

interface Decision {
  id: number;
  decision: string;
}

export interface SearchMatchedDecisionsResponse {
  decisions: MatchedDecision[];
}

const fetchDecisionsFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number) => {
  try {
    console.time('call Decisions')
    const { data: matchedDecisions, error } = await supabaseClient.rpc(`test_match_decisions`, {
      query_embedding: embedding,
      match_count: matchCount,
    });
    console.timeEnd('call Decisions');

    if (error) {
      console.error(`Error fetching decisions from`, error);
      return [];
    }

    //console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({ number: m.number, similarity: m.similarity })));
    return matchedDecisions;
  } catch (err) {
    console.error(`Exception occurred for partition`, err);
    return [];
  }
};

const fetchDecisionsFromID = async (maxIndex: number, embedding: number[], idList: number[]) => {
  try {
    console.time('call Decisions')
    const { data: matchedDecisions, error } = await supabaseClient.rpc(`find_top_matches`, {
      query_embedding: embedding,
      id_list: idList,
    });
    console.timeEnd('call Decisions');

    if (error) {
      console.error(`Error fetching decisions from`, error);
      return [];
    }

    //console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({ number: m.number, similarity: m.similarity })));
    return matchedDecisions;
  } catch (err) {
    console.error(`Exception occurred for partition`, err);
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
  const [{embedding}] = result.data;

  const maxIndex = 3;
  const matchCount = 5;

  try {
    const allDecisions = await fetchDecisionsFromPartitions(maxIndex, embedding, 100);
    const decisionIds: number[] = allDecisions.map((decision: Decision) => decision.id);
    console.log('decisionIds:',decisionIds.length)
    const finalDecisions = await fetchDecisionsFromID(maxIndex, embedding_Voyage, decisionIds);
    console.log(finalDecisions)
    return {
      decisions: finalDecisions
    };
  } catch (err) {
    console.error('Error occurred while fetching decisions:', err);
    return {
      decisions: []
    };
  }
}
