import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getDoctrinesByIds, MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";

const NUM_RELEVANT_CHUNKS = 150;

export const getMatchedDoctrinesTool = tool(async (input) => {
  return getMatchedDoctrines(input);
}, {
  name: 'getMatchedDoctrines',
  description: "Obtient les doctrines les plus similaires à la demande de l'utilisateur",
  schema: z.object({
    query: z.string().describe("La description du problème que l'utilisateur tente de résoudre"),
  })
})

export async function getMatchedDoctrines(input: any): Promise<string> {
  if (!input.query) return "";
  const semanticResponse = await searchMatchedDoctrines(input.query);
  if (semanticResponse.hasTimedOut) return "";

  const bm25Results = await ElasticsearchClient.searchDoctrines(input, NUM_RELEVANT_CHUNKS);
  if (semanticResponse.doctrines.length === 0 || bm25Results.length === 0)
    return "";

  const semanticIds = semanticResponse.doctrines.map((doctrine) => doctrine.id);
  const bm25Ids = bm25Results.map((doctrine: any) => doctrine.id);
  console.log('Nb bm25Results doctrines:', bm25Ids);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 20, 0.65, 0.35);
  const rankFusionIds = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  console.log("RANKFUSION doctrines: ", rankFusionIds);

  const doctrinesToRank = await getDoctrinesByIds(rankFusionIds);
  if (!doctrinesToRank) return "";
  const doctrinesContentToRank = doctrinesToRank?.map((doctrine) => doctrine.paragrapheContent as string);
  if (!doctrinesContentToRank) return "";
  const doctrinesRanked = await rerankWithVoyageAI(input.query, doctrinesContentToRank);
  if (!doctrinesRanked) {
    return "#" + semanticResponse.doctrines?.map((doctrine: MatchedDoctrine) => `Doctrine paragraphe ${doctrine.paragrapheNumber}: ${doctrine.paragrapheContent}`).join("#");
  }
  const filteredRankFusionIds = doctrinesToRank.map((_, i) => {
    const index = doctrinesRanked.data[i].index;
    return rankFusionIds[index];
  });
  const filteredDoctrinesToRank = doctrinesToRank.filter(doctrine =>
    filteredRankFusionIds.includes(doctrine.id)
  );
  return "#" + filteredDoctrinesToRank.map((doctrine) => `Doctrine paragraphe ${doctrine.paragrapheNumber}: ${doctrine.paragrapheContent}`).join("#");
}
