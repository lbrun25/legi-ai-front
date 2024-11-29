import {AIMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {AnalysisQuestion} from "@/lib/types/analysis";
import { ChatOpenAI } from "@langchain/openai";
import {
  getMatchedUserDocumentsByFilenameToolOutput
} from "@/lib/ai/tools/getMatchedUserDocumentsByFilename";
import {DocumentAnalysisPrompt} from "@/lib/ai/langgraph/prompt";

export async function POST(
  req: Request,
) {
  const input: {
    filename: string;
    question: AnalysisQuestion;
  } = await req.json();

  const { signal } = req;

  try {
    console.log('will analyse', input.filename, "with question:", input.question);

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

        try {
          const matchedDocuments = await getMatchedUserDocumentsByFilenameToolOutput(input.question.content, input.filename);

          // Create a stream of responses from the LLM
          const streamWithAccumulation = await llm.stream([
            new SystemMessage(DocumentAnalysisPrompt),
            new HumanMessage(
              `
              Les morceaux du document pertinents: ${matchedDocuments}\n\n
              Voici la question: "${input.question.content}". Le type de réponse attendu est: "${input.question.answerType}".`
            ),
          ]);

          for await (const chunk of streamWithAccumulation) {
            if (signal.aborted) {
              console.log("Streaming aborted, stopping early.");
              controller.close();
              break;
            }
            controller.enqueue(textEncoder.encode(chunk.content as string));
          }
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
