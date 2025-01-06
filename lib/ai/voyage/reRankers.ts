export interface VoyageRerankResponse {
  data: RerankedDocument[];
}

export interface RerankedDocument {
  relevance_score: number;
  index: number;
}


export const rerankWithVoyageAI = async (query: string, documents: string[]): Promise<VoyageRerankResponse | null> => {
  const url = 'https://api.voyageai.com/v1/rerank';
  const apiKey = process.env.VOYAGE_AI_API_KEY;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

      // Vérification que chaque document est bien une chaîne de caractères non vide
  const validDocuments = documents.filter(doc => typeof doc === 'string' && doc.trim().length > 0);
  //console.log('doc : ', documents)
  if (validDocuments.length === 0) {
    console.error("No valid documents provided for reranking.");
    return null;
  }

  const body = {
    query: query,
    documents: documents,
    model: 'rerank-2'
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
      console.error("[rerankWithVoyageAI] Reranking failed with Voyage AI:", responseBody.detail);
      return null;
    }
    //console.debug('rerankWithVoyageAI res:', responseBody);
    return responseBody;
  } catch (error) {
    console.error("[rerankWithVoyageAI] Reranking failed with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};

export const rerankWithVoyageAIMultiLangual = async (query: string, documents: string[]): Promise<VoyageRerankResponse | null> => {
  const url = 'https://api.voyageai.com/v1/rerank';
  const apiKey = process.env.VOYAGE_AI_API_KEY_FOR_INTERNET;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

      // Vérification que chaque document est bien une chaîne de caractères non vide
  const validDocuments = documents.filter(doc => typeof doc === 'string' && doc.trim().length > 0);
  //console.log('doc : ', documents)
  if (validDocuments.length === 0) {
    console.error("No valid documents provided for reranking.");
    return null;
  }

  const body = {
    query: query,
    documents: documents,
    model: 'rerank-2'
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
      console.error("[rerankWithVoyageAIMultiLangual] Reranking failed with Voyage AI:", responseBody.detail);
      return null;
    }
    //console.debug('rerankWithVoyageAI res:', responseBody);
    return responseBody;
  } catch (error) {
    console.error("[rerankWithVoyageAIMultiLangual] Reranking failed with Voyage AI: there was a problem with the fetch operation:", error);
    return null;
  }
};
