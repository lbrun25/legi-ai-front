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

export const searchMatchedDecisions = async (input: string): Promise<SearchMatchedDecisionsResponse> => {
  console.log('searchMatchedDecisions:', input);
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      decisions: []
    }
  }
  const embedding = response.data[0].embedding;

  const maxIndex = 3;
  const matchThreshold = 0.30;
  const matchCount = 5;

  // Array to store all matched decisions
  const allDecisions: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    try {
      const { data: matchedDecisions, error } = await supabaseClient.rpc('match_decisions', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        partition_index: partitionIndex,
      });
      if (error) {
        console.error(`Error fetching decisions from partition ${partitionIndex}:`, error);
        continue;
      }
      console.log(`Fetched decisions from partition ${partitionIndex}:`, matchedDecisions.map((m: MatchedDecision) => JSON.stringify({number: m.number, similarity: m.similarity})));
      if (matchedDecisions) {
        allDecisions.push(...matchedDecisions);
      }
    } catch (err) {
      console.error(`Exception occurred for decisions partition ${partitionIndex}:`, err);
    }
  }

  // Sort all decisions by similarity in descending order
  allDecisions.sort((a, b) => b.similarity - a.similarity);

  // Take the top 5 decisions
  const topDecisions = allDecisions.slice(0, matchCount);

  console.log("got matched decisions:", topDecisions);
  return {
    decisions: topDecisions
  };
}
