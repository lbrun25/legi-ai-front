import {tool} from "@langchain/core/tools";
import {AssistantPrompt} from "@/lib/ai/langgraph/prompt";

export const formatResponse = tool(async () => {
  return AssistantPrompt;
}, {
  name: 'formatResponse',
  description: "Cet outil doit être impérativement appelé pour générer la réponse finale destinée à l'utilisateur.",
})
