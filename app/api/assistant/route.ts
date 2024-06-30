import {AssistantResponse} from 'ai';
import OpenAI from 'openai';
import {ChatCompletionMessageToolCall} from "ai/prompts";
import {getMatchedArticlesToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedArticlesToolOutput";
import {getMatchedDecisionsToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedDecisionsToolOutput";
import {getMatchedDoctrinesToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedDoctrinesToolOutput";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
    {threadId, messageId: createdMessage.id},
    async ({forwardStream, sendDataMessage}) => {
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
              if (toolCall.function.name === "getMatchedArticles")
                return getMatchedArticlesToolOutput(params, toolCall);
              if (toolCall.function.name === "getMatchedDecisions")
                return getMatchedDecisionsToolOutput(params, toolCall);
              if (toolCall.function.name === "getMatchedDoctrines")
                return getMatchedDoctrinesToolOutput(params, toolCall);
            })
        );
        const filteredToolOutputs = toolOutputs.filter(item => !!item);

        runResult = await forwardStream(
          openai.beta.threads.runs.submitToolOutputsStream(
            threadId,
            runResult.id,
            {tool_outputs: filteredToolOutputs},
          ),
        );
      }
    },
  );
}
