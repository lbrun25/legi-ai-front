import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";

export interface MatchedDoctrine {
  id: bigint;
  paragrapheContent: string;
  paragrapheNumber: string;
  similarity: number;
}

export interface SearchMatchedDoctrinesResponse {
  doctrines: MatchedDoctrine[];
}

export const searchMatchedDoctrines = async (input: string): Promise<SearchMatchedDoctrinesResponse> => {
  console.log('searchMatchedDoctrines:', input)
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      doctrines: []
    }
  }
  const embedding = response.data[0].embedding;
  const {data: matchedDoctrines} = await supabaseClient.rpc('match_doctrines', {
    query_embedding: embedding,
    match_threshold: 0.001,
    match_count: 10,
  });
  return {
    doctrines: matchedDoctrines
  };
}
