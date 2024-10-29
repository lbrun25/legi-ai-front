import {z} from "zod";
import {createClient} from "@/lib/supabase/client/server";
import {Thread} from "@/lib/types/thread";
import OpenAI from "openai";
import {AIMessage, HumanMessage} from "@langchain/core/messages";
import {getCompiledGraph} from "@/lib/ai/langgraph/graph";
import {Message} from "@/lib/types/message";
import {PubSub} from "@google-cloud/pubsub";
import {pubSubClient} from "@/lib/google/pubSubClient";
import {StateSnapshot} from "@langchain/langgraph";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const supabase = createClient()
    const {params} = routeContextSchema.parse(context)
    const {data, error} = await supabase
      .from("threads")
      .select("*")
      .eq('thread_id', params.id)
      .single();
    if (error) {
      return new Response(JSON.stringify({error}), {status: 500})
    }
    if (!data) {
      return new Response(null, {status: 404})
    }
    const thread = data as Thread;
    const threadMessages = await openai.beta.threads.messages.list(
      thread.thread_id
    );
    return new Response(JSON.stringify(threadMessages.data), {status: 200})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}

// Send a new message to a thread
export async function POST(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  const input: {
    content: string;
    isFormattingAssistant: boolean;
    messages: Message[]
  } = await req.json();
  const { signal } = req;
  try {
    const {params} = routeContextSchema.parse(context);
    const threadId = params.id;

    const graph = await getCompiledGraph();

    // Start timing the second phase (invoke response)
    console.time("Streaming answer");

    const inputs = {
      messages: input.messages.map((message) => {
        if (message.role === "user") {
          return new HumanMessage(message.text);
        } else if (message.role === "assistant") {
          return new AIMessage(message.text);
        }
      })
    };

    console.log('inputs', inputs);

    const config = {
      version: "v2",
      configurable: { thread_id: threadId },
    };
    const eventStreamFinalRes = graph.streamEvents(inputs, config);

    let firstCalledChunk = false;
    let response = "";
    let lastValidationMessageSent = false;

    const toolsCalled = new Map<string, boolean>();

    const textEncoder = new TextEncoder();
    const transformStream = new ReadableStream({
      async start(controller) {
        // Listen for cancellation
        signal.addEventListener('abort', () => {
          console.log('Request aborted by the client');
          controller.close();
        });

        for await (const { event, tags, data } of eventStreamFinalRes) {
          // Redaction graph is waiting for some inputs (Human-in-the-loop)
          if (data?.input?.awaitingUserInput) {
            console.log("Graph is paused, awaiting user input...");
            const contentToSend = data?.input?.placeholders;
            if (!contentToSend) {
              console.error('no placeholders while awaiting user inputs. Continue.');
              continue;
            }
            console.log('placeholders to send via Pub/Sub:', contentToSend);
            // Publish a message to Pub/Sub requesting user input
            try {
              const topic = pubSubClient.topic("input-requests");
              await topic.publishMessage({
                json: { threadId, content: contentToSend },
              });

              console.log(`Published message for thread ${threadId} requesting user input`);

              // Wait for the user's response from Pub/Sub
              const subscriber = pubSubClient.subscription("input-responses-sub");

              // Create subscription if it does not exist
              const [subscription] = await subscriber.get({ autoCreate: true });

              const userInputs = await new Promise<Record<string, string>>((resolve, reject) => {
                const messageHandler = (message: any) => {
                  const parsedData: { threadId: string, userInputs: Record<string, string> } = JSON.parse(message.data.toString());
                  if (parsedData.threadId === threadId) {
                    console.log('Received user inputs from Pub/Sub:', parsedData.userInputs);
                    resolve(parsedData.userInputs);
                    message.ack();
                    subscription.removeListener('message', messageHandler);
                  }
                };

                // Set up message listener for the subscription
                subscription.on('message', messageHandler);

                // Handle cancellation
                req.signal.addEventListener('abort', () => {
                  subscription.removeListener('message', messageHandler);
                  reject('Request aborted');
                });
              });

              // Get the previous state before resuming
              let parentGraphStateBeforeSubgraph;
              const histories = await graph.getStateHistory(config);
              for await (const historyEntry of histories) {
                if (historyEntry.next[0] === "RedactionGraph") {
                  parentGraphStateBeforeSubgraph = historyEntry;
                }
              }
              let subgraphStateBeforeUserInput;
              const subgraphHistories = await graph.getStateHistory(parentGraphStateBeforeSubgraph.tasks[0].state);
              for await (const subgraphHistoryEntry of subgraphHistories) {
                if (subgraphHistoryEntry.next[0] === "UserInputAgent") {
                  subgraphStateBeforeUserInput = subgraphHistoryEntry;
                }
              }
              const topicAgentInputResponses = pubSubClient.topic("agent-input-responses");
              console.log('will send userInputs with threadId:', threadId)
              await topicAgentInputResponses.publishMessage({
                json: { threadId, userInputs },
              });
              await graph.stream(null, {
                ...subgraphStateBeforeUserInput.config,
                streamMode: "updates",
                subgraphs: true,
              });
            } catch (error) {
              console.error('Error handling user input via Pub/Sub:', error);
              controller.error('Error handling user input');
            }
          }
          // Logs to debug
          if (event !== "on_chat_model_stream") {
            // console.log('event:', event)
            // console.log('data:', data)
          }
          // for time saved
          if (event === "on_chain_end") {
            const messages = data.output.messages;
            if (Array.isArray(messages)) {
              messages?.map((message: any) => {
                const toolName = message.name;
                if (toolName)
                  toolsCalled.set(toolName, true);
              });
            }
          }
          if (signal.aborted) {
            console.log("Streaming aborted, stopping early.");
            controller.close();
            break;
          }

          const output = JSON.stringify(data, null, 2)
          const outputParsed = JSON.parse(output);
          // lastValidationMessage = outputParsed?.input?.kwargs?.content;
          if (outputParsed?.input?.kwargs?.content?.startsWith("[IMPRIMER]"))  {
            if (!lastValidationMessageSent) {
              controller.enqueue(textEncoder.encode(outputParsed?.input?.kwargs?.content.replace("[IMPRIMER]", "")));
            }
            lastValidationMessageSent = true;
            if (!firstCalledChunk) {
              console.timeEnd("Streaming answer");
              firstCalledChunk = true;
            }
          }

          if (event === "on_chat_model_stream" && tags.includes("formatting_agent")) {
            if (!!data.chunk.content) {
              if (!firstCalledChunk) {
                console.timeEnd("Streaming answer");
                firstCalledChunk = true;
              }
              controller.enqueue(textEncoder.encode(data.chunk.content));
            }
          }
        }
        console.log('toolsCalled:', toolsCalled)
        if (toolsCalled.size > 0) {
          const toolsCalledMessage = `Tools called: ${Array.from(toolsCalled.keys()).join(',')}`;
          console.log('will enqueue toolsCalledMessage:', toolsCalledMessage);
          controller.enqueue(textEncoder.encode(toolsCalledMessage));
        }
        controller.close();
      },
    });

    return new Response(transformStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      status: 200,
    })
  } catch (error) {
    console.error(`cannot send message:`, error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}
