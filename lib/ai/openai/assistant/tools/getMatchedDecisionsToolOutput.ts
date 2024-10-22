"use server"
import {ChatCompletionMessageToolCall} from "ai/prompts";
import {MatchedDecision, searchMatchedDecisions} from "@/lib/supabase/searchDecisions";
import {ToolOutput} from "@/lib/types/functionTool";

function decodeQueryInGetMatchedDecisions(jsonString: string): string {
  try {
    const data = JSON.parse(jsonString);
    if ("query" in data) {
      return data.query;
    }
  } catch (error) {
    console.error(`Could not decode getMatchedDecisions query: ${error}`)
  }
  console.error(`Could not find getMatchedDecisions query in parameters`);
  return "";
}

export const getMatchedDecisionsToolOutput = async (params: string, toolCall: ChatCompletionMessageToolCall): Promise<ToolOutput> => {
  const input = decodeQueryInGetMatchedDecisions(params);
  if (input.length === 0) {
    console.error("cannot getMatchedDecisions: input is empty");
    return {
      toolOutput: {
        tool_call_id: toolCall.id,
        output: ""
      }
    };
  }
  console.log('params:', params)
  const matchedDecisionsResponse = await searchMatchedDecisions(input, 5, []);
  console.log('matchedDecisionsResponse:', matchedDecisionsResponse);
  const decisions = "#" + matchedDecisionsResponse.decisions?.map((decision: MatchedDecision) => `Fiche d'arrêt ${decision.number}: ${decision.ficheArret}`).join("#");
  console.log('formatted decisions for the assistant:', decisions);
  return {
    toolOutput: {
      tool_call_id: toolCall.id,
      output: decisions,
    },
    hasTimedOut: matchedDecisionsResponse.hasTimedOut
  };
}
