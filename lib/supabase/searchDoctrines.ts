"use server"
import {embeddingWithVoyageLawForDoctrines} from "@/lib/ai/voyage/embedding";
import {sql} from "@/lib/sql/client";

export interface MatchedDoctrine {
  id: bigint;
  contextual_content: string;
  paragrapheNumber: string;
  bookTitle: string;
  similarity: number;
}

export interface SearchMatchedDoctrinesResponse {
  doctrines: MatchedDoctrine[];
  hasTimedOut: boolean;
  doctrineDomaine: string;
}

interface FetchDoctrinesFromPartitionsResponse {
  doctrines: Pick<MatchedDoctrine, "id">[];
  hasTimedOut: boolean;
}

interface FetchDoctrinesFromIdsResponse {
  doctrines: MatchedDoctrine[];
  hasTimedOut: boolean;
}

const fetchDoctrinesFromPartitions = async (maxIndex: number, embedding: number[], matchCount: number): Promise<FetchDoctrinesFromPartitionsResponse> => {
  const allDoctrines: MatchedDoctrine[] = [];
  const promises: any[] = [];
  let hasTimedOut = false;

  const formattedEmbedding = `[${embedding.join(',')}]`;

  for (let partitionIndex = 0; partitionIndex <= maxIndex; partitionIndex++) {
    const promise = (async () => {
      try {
        const functionName = `match_doctrines_part_${partitionIndex}_adaptive`;

        const query = sql.unsafe(`
          SELECT * FROM ${functionName}($1::halfvec, $2::int)
        `, [formattedEmbedding, matchCount]);

        const matchedDoctrines = await query as unknown as MatchedDoctrine[];

        // console.log(`Fetched doctrines from partition ${partitionIndex}:`, matchedDoctrines.map((m: MatchedDoctrine) => JSON.stringify({ number: m.paragrapheNumber, similarity: m.similarity })));

        if (matchedDoctrines) {
          return matchedDoctrines;
        } else {
          return [];
        }
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

  return {
    doctrines: allDoctrines,
    hasTimedOut: hasTimedOut,
  };
};

const fetchDoctrinesFromIds = async (embedding: number[], idList: bigint[], matchCount: number): Promise<FetchDoctrinesFromIdsResponse> => {
  // console.log('Will call match_doctrines_by_ids with IDs:', idList);
  try {
    console.time('call match_doctrines_by_ids')
    const formattedEmbedding = `[${embedding.join(',')}]`;
    const formattedIdList = `{${idList.join(',')}}`;

    const query = sql.unsafe(`
      SELECT * FROM match_doctrines_by_ids_2($1, $2, $3, $4)
    `, [formattedEmbedding, 0.2, matchCount, formattedIdList]);

    const matchedDoctrines = await query as unknown as MatchedDoctrine[];
    console.timeEnd('call match_doctrines_by_ids');

    return {
      doctrines: matchedDoctrines,
      hasTimedOut: false,
    };
  } catch (error) {
    console.error(`Exception occurred when fetching doctrines from indexes:`, error);
    return {
      doctrines: [],
      hasTimedOut: false
    };
  }
};

export const searchMatchedDoctrines = async (input: string, limit: number = 5, idList: bigint[]): Promise<SearchMatchedDoctrinesResponse> => {
  //console.log('searchMatchedDoctrines:', idList);
  const response = await embeddingWithVoyageLawForDoctrines(input)
  if (!response) {
    return {
      doctrines: [],
      hasTimedOut: false,
      doctrineDomaine: "",
    };
  }
  const embedding_Voyage = response.data[0].embedding;
  /*const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  const result = await openai.embeddings.create({
    input,
    model: "text-embedding-3-large",
  });
  const [{embedding: embeddingOpenai}] = result.data;

  const maxIndex = 0;
  const matchCount = 10;*/

  try {
    /*const fetchDoctrinesFromPartitionsResponse = await fetchDoctrinesFromPartitions(maxIndex, embeddingOpenai, matchCount);
    if (fetchDoctrinesFromPartitionsResponse.hasTimedOut) {
      return {
        doctrines: [],
        hasTimedOut: true,
        doctrineDomaine: "",
      }
    }
    const doctrineIds: bigint[] = fetchDoctrinesFromPartitionsResponse.doctrines.map((doctrine) => doctrine.id);*/
    const fetchDoctrinesFromIdsResponse = await fetchDoctrinesFromIds(embedding_Voyage, idList, limit);
    const domaine = fetchDoctrinesFromIdsResponse.doctrines[0]?.bookTitle;
    //console.log(`topDoctrines:`, fetchDoctrinesFromIdsResponse.doctrines.map((m: MatchedDoctrine) => JSON.stringify({ id: m.id, bookTitle: m.bookTitle, paragrapheNumber:m.paragrapheNumber, similarity: m.similarity})));
    return {
      doctrines: fetchDoctrinesFromIdsResponse.doctrines,
      hasTimedOut: fetchDoctrinesFromIdsResponse.hasTimedOut,
      doctrineDomaine: domaine,
    };
  } catch (err) {
    console.error('Error occurred while fetching doctrines:', err);
    return {
      doctrines: [],
      hasTimedOut: false,
      doctrineDomaine: "",
    };
  }
}

export async function getDoctrinesByIds(ids: bigint[]) {
  let retries = 0;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  while (retries < 5) {
    try {
      const data = await sql.unsafe(
        `
          SELECT id, contextual_content, "paragrapheNumber", "bookTitle"
          FROM "LegalDoctrine"
          WHERE id = ANY($1::bigint[])
        `,
        // @ts-ignore
        [ids]
      );
      return data;
    } catch (error) {
      retries++;
      console.error(`Attempt ${retries}/5 failed:`, error);

      if (retries === 5) {
        console.error('Max retries reached. Returning null.');
        return null;
      }

      await delay(200 * retries);
    }
  }

  return null;
}
