interface VoyageEmbedding {
  object: string;
  embedding: number[];
  index: number;
}

interface VoyageUsage {
  total_tokens: number;
}

interface VoyageEmbeddingResponse {
  object: string;
  data: VoyageEmbedding[];
  model: string;
  usage: VoyageUsage;
}

interface VoyageEmbeddingErrorResponse {
  detail: string;
}

export const embeddingWithVoyageLaw = async (input: string): Promise<VoyageEmbeddingResponse | null> => {
  const url = 'https://api.voyageai.com/v1/embeddings';
  const apiKey = process.env.VOYAGE_AI_API_KEY;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const body = {
    input: [input],
    model: 'voyage-law-2'
  };
  const options = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorResponse: VoyageEmbeddingErrorResponse = await response.json();
      console.error("Cannot embed text with Voyage AI:", errorResponse);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Cannot embed text with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};
