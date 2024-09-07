import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";

export const getMatchedDecisions = tool(async (input) => {
  if (!input.query) return "";
  const matchedDecisionsResponse = await searchMatchedDecisions(input.query);
  if (matchedDecisionsResponse.hasTimedOut) return "";
  return "#" + matchedDecisionsResponse.decisions?.map((decision: MatchedDecision) => `Fiche d'arrêt ${decision.number}: ${decision.ficheArret}`).join("#");
}, {
  name: 'getMatchedDecisions',
  description: "Obtient la position de la jurisprudence sur la question de droit formulée",
  schema: z.object({
    query: z.string().describe("Question rédigée sur le modèle d’une question de droit dans une fiche d’arrêt."),
  })
})
