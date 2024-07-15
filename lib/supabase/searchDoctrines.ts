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

const fetchDoctrinesFromPartitions = async (maxIndex, embedding, matchCount, supabaseClient) => {
  const allDoctrines = [];
  const promises = [];

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        const { data: matchedDoctrines, error } = await supabaseClient.rpc(`match_doctrines_part_${partitionIndex}_adaptive`, {
          query_embedding: embedding,
          match_count: matchCount,
        });

        if (error) {
          console.error(`Error fetching doctrines from partition ${partitionIndex}:`, error);
          return [];
        }

        console.log(`Fetched doctrines from partition ${partitionIndex}:`, matchedDoctrines.map((m: MatchedDoctrine) => JSON.stringify({ number: m.paragrapheNumber, similarity: m.similarity })));
        return matchedDoctrines;
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
        allDoctrines.push(...result.value);
      } else {
        if ("reason" in result) {
          console.error('A promise was rejected:', result.reason);
        }
      }
    });
  } catch (err) {
    console.error('Unexpected error occurred while fetching doctrines from partitions:', err);
  }

  return allDoctrines;
};

export const searchMatchedDoctrines = async (input: string): Promise<SearchMatchedDoctrinesResponse> => {
  console.log('searchMatchedDoctrines:', input);
  const response = await embeddingWithVoyageLaw(input)
  if (!response) {
    return {
      doctrines: []
    }
  }
  const embedding = response.data[0].embedding;

  const maxIndex = 3;
  //const matchThreshold = 0.30;
  const matchCount = 5;

  try {
    const allDoctrines = await fetchDoctrinesFromPartitions(maxIndex, embedding, matchCount, supabaseClient);
    allDoctrines.sort((a, b) => b.similarity - a.similarity);
    const topDoctrines = allDoctrines.slice(0, matchCount);
    return {
      doctrines: topDoctrines
    };
  } catch (err) {
    console.error('Error occurred while fetching doctrines:', err);
    return {
      doctrines: []
    };
  }
}
