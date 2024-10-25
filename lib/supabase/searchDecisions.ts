"use server"
import {embeddingWithVoyageLawForDecisions} from "@/lib/ai/voyage/embedding";
import {OpenAI} from "openai";
import {sql} from "@/lib/sql/client";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import postgres from "postgres";

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

interface FetchDecisionsFromIdsResponse {
  decisions: MatchedDecision[];
  hasTimedOut: boolean;
}


const fetchDecisionsFromIds = async (
  embedding: number[],
  idList: bigint[],
  limit: number
): Promise<FetchDecisionsFromIdsResponse> => {
  try {
    const matchCount: number = 40;

    // Divisez la liste d'ID en 30 parties
    const partLength = Math.ceil(idList.length / 5);
    const idLists = Array.from({ length: 5 }, (_, index) =>
      idList.slice(index * partLength, (index + 1) * partLength)
    );

    /*      const sql = postgres({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 6543,
        username: 'postgres.emgtfetkdcnieuwxswet',
        password: '4pI9VtldkXuVvKP3',
        database: 'postgres',
      });*/
    // Créez un tableau de promesses pour chaque partie
    const promises = idLists.map((ids, index) => {
      const formattedEmbedding = `[${embedding.join(',')}]`;
      const formattedIdList = `{${ids.join(',')}}`;
      return sql.unsafe(
        `
        SELECT * FROM match_decisions_by_ids_full_content_${index}($1, $2, $3, $4)
        `,
        [formattedEmbedding, 0.2, matchCount, formattedIdList]
      );
    });

    const results = await Promise.all(promises);
    const matchedDecisions = results.flat().map(result => result as unknown as MatchedDecision);
    const sortedDecisions = matchedDecisions.sort((a, b) => b.similarity - a.similarity);
    const limitedDecisions = sortedDecisions.slice(0, limit);
    //console.log("[fetchDecisionsFromIds] limitedDecisions :", limitedDecisions);

    return {
      decisions: limitedDecisions,
      hasTimedOut: false,
    };
  } catch (error) {
    console.error('Exception occurred when fetching decisions from indexes:', error);
    return {
      decisions: [],
      hasTimedOut: false,
    };
  }
};


export const searchMatchedDecisions = async (input: string, limit: number = 5, decisionIds: bigint[]): Promise<SearchMatchedDecisionsResponse> => {
  //console.log('searchMatchedDecisions:', input);
  const response = await embeddingWithVoyageLawForDecisions(input);
  if (!response) {
    return {
      decisions: [],
      hasTimedOut: false,
    }
  }
  const embedding_Voyage = response.data[0].embedding;

  try {
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
