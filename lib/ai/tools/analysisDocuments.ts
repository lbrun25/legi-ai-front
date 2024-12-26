import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getUserId} from "@/lib/supabase/utils";

export const analysisDocumentsTool = tool(async (input) => {
  if (!input.query) return "";
  return await analysisDocumentsToolOutput(input.query);
}, {
  name: 'analysisDocuments',
  description: "Utilise ce tool pour répondre aux questions spécifiques d'un utilisateur sur ses documents.",
  schema: z.object({
    query: z.string().describe("Question de l'utilisateur à propos des documents."),
  })
})

const analysisDocumentsToolOutput = async (query: string) => {

}
