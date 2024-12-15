import {z} from "zod";
import {createClient} from "@/lib/supabase/client/server";
import {Thread} from "@/lib/types/thread";
import OpenAI from "openai";
import {AIMessage, HumanMessage} from "@langchain/core/messages";
import {getCompiledGraph} from "@/lib/ai/langgraph/graph";
import {Message} from "@/lib/types/message";
import {MikeMode} from "@/lib/types/mode";
import {getCompiledAnalysisGraph} from "@/lib/ai/langgraph/analysisGraph";
import {getUserId} from "@/lib/supabase/utils";
import {NextResponse} from "next/server";

export const maxDuration = 300;
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

const startAssistantStream = (threadId: string, assistantId: string, controller: ReadableStreamDefaultController<any>) => {
  const encoder = new TextEncoder();

  openai.beta.threads.runs
    .stream(threadId, {
      assistant_id: assistantId,
    })
    .on("textCreated", (event) => {
      // console.log("assistant >", event);
    })
    .on("textDelta", (event) => {
      if (event.annotations && event.value) {
        for (let annotation of event.annotations) {
          if (annotation.text)
            event.value = event.value.replace(annotation.text, "[" + annotation.index + "]");
        }
      }
      controller.enqueue(encoder.encode(event.value));
    })
    .on("messageDone", async (event) => {
      if (event.content[0].type === "text") {
        const { text } = event.content[0];
        const { annotations } = text;
        const citations: string[] = [];

        let index = 0;
        for (let annotation of annotations) {
          text.value = text.value.replace(annotation.text, "[" + index + "]");
          const { file_citation } = annotation as { file_citation?: { file_id: string } };
          // console.log('annotation:', annotation)
          if (file_citation) {
            const citedFile = await openai.files.retrieve(file_citation.file_id);
            citations.push("[" + index + "]" + citedFile.filename);
          }
          index++;
        }
        if (citations.length > 0)
          controller.enqueue(encoder.encode("\n\nCitations:\n" + citations.join("\n") + "\n"));
      }
      controller.close(); // Close the stream when done
    })
    .on("error", (error) => {
      console.error("Stream error:", error);
      controller.enqueue(encoder.encode("Error: " + error.message));
      controller.close();
    });
};

// Send a new message to a thread
export async function POST(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  // TODO: add mutiform or pass base64 images?
  const input: {
    content: string;
    isFormattingAssistant: boolean;
    messages: Message[],
    selectedMode?: MikeMode,
    fileIds?: string[],
    filesWithBase64: {filename: string; content: string}[],
  } = await req.json();
  const { signal } = req;
  try {
    const {params} = routeContextSchema.parse(context);
    const threadId = params.id;

    const selectedMode = input?.selectedMode ?? "research";
    if (selectedMode === "synthesis") {
      const fileIds = input?.fileIds || [];
      if (fileIds.length === 0)
        return new Response("no files were provided while it requires analysis", {status: 400})
      // console.log('fileIds:', fileIds);
      // console.log('Create vector store...');
      let vectorStore = await openai.beta.vectorStores.create({
        file_ids: fileIds,
        expires_after: {
          anchor: "last_active_at",
          days: 1,
        }
      });
      console.log('Create assistant...');
      const assistantId = process.env.ASSISTANT_ID ??
        (() => {
          throw new Error('ASSISTANT_ID is not set');
        })();
      let assistant = await openai.beta.assistants.retrieve(assistantId);
      if (assistant?.id !== assistantId) {
        openai.beta.assistants.create({
          instructions: "Tu es un expert juridique, sert toi de tes connaissances pour répondre à des questions sur des documents, si on te le demande tu as la possibilité d'établir une systhèse des documents.",
          model: "gpt-4o-mini",
          temperature: 0,
          tools: [{ type: "file_search" }],
          tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
        });
      } else {
        assistant = await openai.beta.assistants.update(
          assistantId,
          {
            tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
          }
        );
      }
      await openai.beta.threads.messages.create(
        threadId,
        { role: "user", content: input.content }
      );
      const stream = new ReadableStream({
        async start(controller) {
          startAssistantStream(threadId, assistantId, controller);
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        status: 200,
      });
    }

    if (selectedMode === "analysis") {
      const userId = await getUserId();
      const indexName = `documents_${userId}`;
      const inputData = {
        input: {
          action: "search",
          query: input.content,
          files: input.filesWithBase64,
          index_name: indexName,
        },
      };
      const response = await fetch("https://api.runpod.ai/v2/8f62vdeuvpg10x/runsync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
        body: JSON.stringify(inputData),
      });
      const result = await response.json();
      const statusCode = result.output[1];
      if (statusCode !== 200) {
        const error = result.output[0].error;
        console.error("cannot search in documents with colpali:", error);
        return NextResponse.json({ message: error }, { status: statusCode });
      }
      const colpaliAnswer = result.output[0].answer;

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          // Listen for cancellation
          signal.addEventListener('abort', () => {
            console.log('Request aborted by the client');
            controller.close();
          });
          controller.enqueue(textEncoder.encode(colpaliAnswer));
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
    }

    const app = await getCompiledGraph();

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

    // console.log('inputs', inputs);

    const eventStreamFinalRes = app.streamEvents(inputs, {
      version: "v2",
      configurable: { thread_id: threadId },
    });

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

        for await (const { event, data, tags } of eventStreamFinalRes) {
          // Logs to debug
          if (event !== "on_chat_model_stream") {
            // console.log('event:', event)
            // console.log('data:', data)
          }
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
