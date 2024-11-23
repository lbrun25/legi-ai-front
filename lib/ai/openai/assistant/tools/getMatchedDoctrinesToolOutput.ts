"use server"
import {ChatCompletionMessageToolCall} from "ai/prompts";
import {MatchedDoctrine, searchMatchedDoctrines} from "@/lib/supabase/searchDoctrines";
import {ToolOutput} from "@/lib/types/functionTool";

function decodeQueryInGetMatchedDoctrines(jsonString: string): string {
//   try {
//     const data = JSON.parse(jsonString);
//     if ("query" in data) {
//       return data.query;
//     }
//   } catch (error) {
//     console.error(`Could not decode getMatchedDoctrines query: ${error}`)
//   }
//   console.error(`Could not find getMatchedDoctrines query in parameters`);
//   return "";
// }
//
// export const getMatchedDoctrinesToolOutput = async (params: string, toolCall: ChatCompletionMessageToolCall): Promise<ToolOutput> => {
//   const input = decodeQueryInGetMatchedDoctrines(params);
//   if (input.length === 0) {
//     console.error("cannot getMatchedDoctrines: input is empty");
//     return {
//       toolOutput: {
//         tool_call_id: toolCall.id,
//         output: ""
//       }
//     };
//   }
//   console.log('params:', params)
//   const matchedDoctrinesResponse = await searchMatchedDoctrines(input);
//   console.log('matchedDoctrinesResponse:', matchedDoctrinesResponse);
//   const doctrines = "#" + matchedDoctrinesResponse.doctrines?.map((doctrine: MatchedDoctrine) => `Doctrine paragraphe ${doctrine.paragrapheNumber}: ${doctrine.paragrapheContent}`).join("#");
//   console.log('formatted doctrines for the assistant:', doctrines);
//   return {
//     toolOutput: {
//       tool_call_id: toolCall.id,
//       output: doctrines,
//     },
//     hasTimedOut: matchedDoctrinesResponse.hasTimedOut
//   };
  return "";
}
