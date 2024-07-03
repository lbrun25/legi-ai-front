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
  const {data: matchedDecisions, error} = await supabaseClient.rpc('match_decisions', {
    query_embedding: embedding,
    match_threshold: 0.001,
    match_count: 10,
  })
  if (error) {
    console.error('cannot search matched decisions:', error);
  }
  console.log("got matched decisions:", matchedDecisions);
  return {
    decisions: matchedDecisions
  };
}
