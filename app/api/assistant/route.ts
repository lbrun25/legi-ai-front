import { AssistantResponse } from 'ai';
import OpenAI from 'openai';
import {ChatCompletionMessageToolCall} from "ai/prompts";
import {MatchedArticle, searchMatchedArticles} from "@/lib/supabase/searchArticles";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

function decodeQueryInGetMatchedArticles(jsonString: string): string {
  try {
    const data = JSON.parse(jsonString);
    if ("query" in data) {
      return data.query;
    }
  } catch (error) {
    console.error(`Could not decode getMatchedArticles query: ${error}`)
  }
  console.error(`Could not find getMatchedArticles query in parameters`);
  return "";
}

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    threadId: string | null;
    message: string;
  } = await req.json();

  // Create a thread if needed
  const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

  // Add a message to the thread
  const createdMessage = await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: input.message,
  });

  return AssistantResponse(
    { threadId, messageId: createdMessage.id },
    async ({ forwardStream, sendDataMessage }) => {
      // Run the assistant on the thread
      const runStream = openai.beta.threads.runs.stream(threadId, {
        assistant_id:
          process.env.ASSISTANT_ID ??
          (() => {
            throw new Error('ASSISTANT_ID is not set');
          })(),
      });

      // forward run status would stream message deltas
      let runResult = await forwardStream(runStream);

      // status can be: queued, in_progress, requires_action, cancelling, cancelled, failed, completed, or expired
      while (
        runResult?.status === 'requires_action' &&
        runResult.required_action?.type === 'submit_tool_outputs'
        ) {
        const toolOutputs = await Promise.all(
          runResult.required_action.submit_tool_outputs.tool_calls
            .map(async (toolCall: ChatCompletionMessageToolCall) => {
              const params = toolCall.function.arguments;
              if (toolCall.function.name === "getMatchedArticles") {
                const input = decodeQueryInGetMatchedArticles(params);
                if (input.length === 0) {
                  console.error("cannot getMatchedArticles: input is empty");
                  return {
                    tool_call_id: toolCall.id,
                    output: ""
                  };
                }
                const matchedArticlesResponse: any = await searchMatchedArticles(input);
                console.log('matchedArticlesResponse:', matchedArticlesResponse);
                const articles = "#" + matchedArticlesResponse.map((article: MatchedArticle) => `Article ${article.number}: ${article.content}`).join("#");
                console.log('articles:', articles);
                console.log('tool call id:', toolCall.id);
                return {
                  tool_call_id: toolCall.id,
                  output: articles,
                };
              }
            })
        );
        const filteredToolOutputs = toolOutputs.filter(item => !!item);

        runResult = await forwardStream(
          openai.beta.threads.runs.submitToolOutputsStream(
            threadId,
            runResult.id,
            { tool_outputs: filteredToolOutputs },
          ),
        );
      }
    },
  );
}
