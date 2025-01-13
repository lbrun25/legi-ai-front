import {sql} from "@/lib/sql/client";
import {embeddingWithVoyageLaw} from "@/lib/ai/voyage/embedding";
import {CollectiveAgreementDocument} from "@/lib/types/agreement";

export type MatchedCollectiveAgreementDocument = Pick<CollectiveAgreementDocument, "id" | "content">

export const matchAgreementArticles = async (
  idcc: string,
  embedding: number[],
  threshold: number,
  matchCount: number
): Promise<MatchedCollectiveAgreementDocument[]> => {
  const functionName = `match_conv_coll_${idcc}`;
  const formattedEmbedding = `[${embedding.join(',')}]`;

  return sql.unsafe(
    `
      SELECT id, content
      FROM "${functionName}"($1, $2, $3)
    `,
    [formattedEmbedding, threshold, matchCount]
  );
};

export const searchArticlesInCollectiveAgreement = async (
  idcc: string,
  query: string,
): Promise<MatchedCollectiveAgreementDocument[]> => {
  const voyageApiKey = process.env.VOYAGE_AI_API_KEY ??
    (() => {
      throw new Error('VOYAGE_AI_API_KEY is not set');
    })();
  const inputEmbeddingVoyageResponse = await embeddingWithVoyageLaw(query, voyageApiKey);
  if (!inputEmbeddingVoyageResponse) {
    return [];
  }
  const inputEmbeddingVoyage = inputEmbeddingVoyageResponse.data[0].embedding;

  return await matchAgreementArticles(idcc, inputEmbeddingVoyage, 0.2, 5);
}
