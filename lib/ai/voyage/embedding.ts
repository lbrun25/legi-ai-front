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

export const embeddingWithVoyageLaw = async (input: string, apiKey: string): Promise<VoyageEmbeddingResponse | null> => {
  const url = 'https://api.voyageai.com/v1/embeddings';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  console.log('embeddingWithVoyageLaw input:', input)
  const body = {
    input: input,
    model: 'voyage-law-2'
  };
  const options = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  };

  try {
    const response = await fetch(url, options);
    const responseBody = await response.json();
    if (!response.ok) {
      console.error("Cannot embed text with Voyage AI:", (responseBody as VoyageEmbeddingErrorResponse).detail);
      return null;
    }
    console.debug('embeddingWithVoyageLaw res:', responseBody)
    return responseBody;
  } catch (error) {
    console.error("Cannot embed text with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};

export const embeddingWithVoyageLawForDoctrines = async (input: string): Promise<VoyageEmbeddingResponse | null> => {
  const url = 'https://api.voyageai.com/v1/embeddings';
  const apiKey = process.env.VOYAGE_AI_API_KEY_FOR_DOCTRINES;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  //console.log('embeddingWithVoyageLaw input:', input)
  const body = {
    input: input,
    model: 'voyage-law-2'
  };
  const options = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  };

  try {
    const response = await fetch(url, options);
    const responseBody = await response.json();
    if (!response.ok) {
      console.error("Cannot embed text with Voyage AI:", (responseBody as VoyageEmbeddingErrorResponse).detail);
      return null;
    }
    //console.log('embeddingWithVoyageLaw res:', responseBody)
    return responseBody;
  } catch (error) {
    console.error("Cannot embed text with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};

export const embeddingWithVoyageLawForDecisions = async (input: string): Promise<VoyageEmbeddingResponse | null> => {
  const url = 'https://api.voyageai.com/v1/embeddings';
  const apiKey = process.env.VOYAGE_AI_API_KEY_FOR_DECISIONS;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  //console.log('embeddingWithVoyageLaw input:', input)
  const body = {
    input: input,
    model: 'voyage-law-2'
  };
  const options = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  };

  try {
    const response = await fetch(url, options);
    const responseBody = await response.json();
    if (!response.ok) {
      console.error("Cannot embed text with Voyage AI:", (responseBody as VoyageEmbeddingErrorResponse).detail);
      return null;
    }
    //console.log('embeddingWithVoyageLaw res:', responseBody)
    return responseBody;
  } catch (error) {
    console.error("Cannot embed text with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};
