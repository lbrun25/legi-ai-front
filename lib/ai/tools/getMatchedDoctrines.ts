import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";

export const getMatchedDoctrines = tool(async (input) => {
  if (!input.query) return "";
  const matchedDoctrinesResponse = await searchMatchedDoctrines(input.query);
  if (matchedDoctrinesResponse.hasTimedOut) return "";
  const domaine = matchedDoctrinesResponse.doctrineDomaine
  const content = "#" + matchedDoctrinesResponse.doctrines?.map((doctrine: MatchedDoctrine) => `Contenu du paragraphe n°${doctrine.paragrapheNumber} : ${doctrine.paragrapheContent}\n`).join("#");
  const result = `${domaine}:\n${content}`
  console.log(result);
  return `${domaine}:\n${content}`;
}, {
  name: 'getMatchedDoctrines',
  description: "Obtient les doctrines les plus similaires à la demande de l'utilisateur",
  schema: z.object({
    query: z.string().describe("La description du problème que l'utilisateur tente de résoudre"),
  })
})
