import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {searchMatchedUserDocuments} from "@/lib/supabase/documents";
import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getMatchedUserDocuments} from "@/lib/utils/documents";

const NUM_RELEVANT_CHUNKS = 60;

export const getMatchedUserDocumentsTool = tool(async (input) => {
  if (!input.query) return "";
  return await getMatchedUserDocumentsToolOutput(input.query);
}, {
  name: 'getMatchedUserDocuments',
  description: "Utilise ce tool pour répondre aux questions spécifiques d'un utilisateur sur son document. Il récupère les informations liées au document pour fournir une réponse détaillée.",
  schema: z.object({
    query: z.string().describe("Question de l'utilisateur à propos du document."),
  })
})

const getMatchedUserDocumentsToolOutput = async (input: string) => {
  const semanticResponse = await searchMatchedUserDocuments(input, NUM_RELEVANT_CHUNKS, 0.2);
  // console.log('semanticResponse:', semanticResponse);
  const bm25Results = await ElasticsearchClient.searchUserDocuments(input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.length === 0 || bm25Results.length === 0) {
    console.warn("no result were found for semantic and BM25 search.");
    return "";
  }
  return await getMatchedUserDocuments(input, semanticResponse, bm25Results);
}
