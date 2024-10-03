import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";

const NUM_RELEVANT_CHUNKS = 150;

export const getMatchedDecisions = tool(async (input) => {
  if (!input.query) return "";
  const semanticResponse = await searchMatchedDecisions(input.query, NUM_RELEVANT_CHUNKS);
  console.log('Nb semanticResponse:', semanticResponse.decisions.length)
  if (semanticResponse.hasTimedOut) return "";

  const bm25Results = await ElasticsearchClient.searchDecisions(input.query, NUM_RELEVANT_CHUNKS);
  console.log('Nb bm25Results:', bm25Results.length)

  if (semanticResponse.decisions.length === 0 || bm25Results.length === 0)
    return "";

  const semanticIds = semanticResponse.decisions.map((decision) => decision.id);
  const bm25Ids = bm25Results.map((decision: any) => decision.id);

  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.8, 0.2);
  console.log('rankFusionResult:', rankFusionResult);

  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0.5).map(result => result.id);
  const filteredDecisions = semanticResponse.decisions.filter(decision => rankFusionIds.includes(decision.id));

  return "#" + filteredDecisions.map((decision: MatchedDecision) => `Décision de la ${decision.juridiction} ${decision.number} du ${decision.date} : ${decision.ficheArret}`).join("#");
}, {
  name: 'getMatchedDecisions',
  description: "Obtient la position de la jurisprudence sur la question de droit formulée",
  schema: z.object({
    query: z.string().describe("Question rédigée sur le modèle d’une question de droit dans une fiche d’arrêt."),
  })
})
