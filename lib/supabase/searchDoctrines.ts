import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {supabaseClient} from "@/lib/supabase/supabaseClient";

export interface MatchedDoctrine {
  id: bigint;
  paragraphecontent: string;
  paragraphenumber: string;
  similarity: number;
}

export interface SearchMatchedDoctrinesResponse {
  doctrines: MatchedDoctrine[];
}

export const searchMatchedDoctrines = async (input: string): Promise<SearchMatchedDoctrinesResponse> => {
  console.log('searchMatchedDoctrines:', input);
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      doctrines: []
    }
  }
  const embedding = response.data[0].embedding;

  const maxIndex = 9;
  const matchThreshold = 0.30;
  const matchCount = 5;

  const allDoctrines: any[] = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    try {
      const { data: matchedDoctrines, error } = await supabaseClient.rpc('match_doctrines', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        partition_index: partitionIndex,
      });
      if (error) {
        console.error(`Error fetching from partition ${partitionIndex}:`, error);
        continue;
      }
      console.log(`Fetched doctrines from partition ${partitionIndex}:`, matchedDoctrines.map((m: MatchedDoctrine) => JSON.stringify({number: m.paragraphenumber, similarity: m.similarity})));
      if (matchedDoctrines) {
        allDoctrines.push(...matchedDoctrines);
      }
    } catch (err) {
      console.error(`Exception occurred for partition ${partitionIndex}:`, err);
    }
  }
  allDoctrines.sort((a, b) => b.similarity - a.similarity);
  const topDoctrines = allDoctrines.slice(0, matchCount);

  console.log("got matched doctrines:", topDoctrines);
  return {
    doctrines: topDoctrines
  };
}
