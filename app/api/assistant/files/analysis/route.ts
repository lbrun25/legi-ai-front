import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { DocumentAnalysisPrompt } from "@/lib/ai/langgraph/prompt";
import {AnalysisQuestion} from "@/lib/types/analysis";

export async function POST(
  req: Request,
) {
  const input: {
    answer: string;
    question: AnalysisQuestion;
  } = await req.json();

  const { signal } = req;

  try {
    console.log('will analyse', "with answer:", input.answer);

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    });

    const stream = new ReadableStream({
      async start(controller) {
        // Listen for cancellation
        signal.addEventListener("abort", () => {
          console.log("Request aborted by the client");
          controller.close();
        });

        const textEncoder = new TextEncoder();
        let accumulatedResponse = "";

        try {
          // Create a stream of responses from the LLM
          const streamWithAccumulation = await llm.stream([
            new SystemMessage(DocumentAnalysisPrompt),
            new HumanMessage(
              `
              Voici la réponse après l'analyse du document: ${input.answer}\nLe type de réponse attendu est: "${input.question.answerType}".`
            ),
          ]);

          for await (const chunk of streamWithAccumulation) {
            if (signal.aborted) {
              console.log("Streaming aborted, stopping early.");
              controller.close();
              break;
            }
            accumulatedResponse += chunk.content;
            controller.enqueue(textEncoder.encode(chunk.content as string));
          }
          console.log(`Query: ${input.question.content}\nAnswer: ${accumulatedResponse}\n\nColpali answer: ${input.answer}`);
          controller.close();
        } catch (error) {
          console.error("Error processing tool or LLM response:", error);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      status: 200,
    });
  } catch (error) {
    console.error("cannot analyse the document:", error);
    return new Response(null, {status: 500})
  }
}
