import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";

export const getMatchedDoctrines = tool(async (input) => {
  if (!input.query) return "";
  const matchedDoctrinesResponse = await searchMatchedDoctrines(input.query);
  if (matchedDoctrinesResponse.hasTimedOut) return "";
  return "#" + matchedDoctrinesResponse.doctrines?.map((doctrine: MatchedDoctrine) => `Doctrine paragraphe ${doctrine.paragrapheNumber}: ${doctrine.paragrapheContent}`).join("#");
}, {
  name: 'getMatchedDoctrines',
  description: "Obtient les doctrines les plus similaires à la demande de l'utilisateur",
  schema: z.object({
    query: z.string().describe("La description du problème que l'utilisateur tente de résoudre"),
  })
})
