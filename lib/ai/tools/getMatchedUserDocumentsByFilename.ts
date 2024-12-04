import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {searchMatchedUserDocumentsByFilename} from "@/lib/supabase/documents";
import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getMatchedUserDocuments} from "@/lib/utils/documents";

const NUM_RELEVANT_CHUNKS = 60;

export const getMatchedUserDocumentsByFilenameTool = tool(async (input) => {
  if (!input.query || !input.filename) return "";
  return await getMatchedUserDocumentsByFilenameToolOutput(input.query, input.filename);
}, {
  name: 'getMatchedUserDocuments',
  description: "Utilise ce tool pour répondre aux questions spécifiques d'un utilisateur sur son document. Il récupère les informations liées au document pour fournir une réponse détaillée.",
  schema: z.object({
    query: z.string().describe("Question de l'utilisateur à propos du document."),
    filename: z.string().describe("Le nom du fichier pour lequel obtenir les informations."),
  })
})

export const getMatchedUserDocumentsByFilenameToolOutput = async (input: string, filename: string) => {
  const semanticResponse = await searchMatchedUserDocumentsByFilename(input, filename, NUM_RELEVANT_CHUNKS, 0.2);
  // Filter to include only results with the correct filename
  const filteredSemanticResponse = semanticResponse.filter(result => result.filename === filename);
  const fileNames = filteredSemanticResponse.map(result => result.filename);
  console.log('semantic files:', fileNames);
  console.log('semanticResponse nb:', filteredSemanticResponse.length);
  console.log('filename:', filename);
  const bm25Results = await ElasticsearchClient.searchUserDocumentsByFilename(input, filename, NUM_RELEVANT_CHUNKS);
  console.log('bm25Results nb:', bm25Results.length);
  // console.log('bm25Results files:', bm25Results.map((result: any) => result.filename));
  if (filteredSemanticResponse.length === 0 || bm25Results.length === 0) {
    console.warn("no result were found for semantic and BM25 search.");
    return "";
  }
  return getMatchedUserDocuments(input, filteredSemanticResponse, bm25Results);
}
