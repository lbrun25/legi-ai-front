import {NextResponse} from "next/server";
import {AnalysisQuestion} from "@/lib/types/analysis";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input: {
    filename: string;
    fileBase64: string;
    questions: AnalysisQuestion[];
  } = await req.json();

  try {
    if (!input.filename || !input.fileBase64 || !input.questions) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    const inputData = {
      input: {
        action: 'analysis',
        questions: input.questions.map((q) => q.content),
        files: [
          {
            filename: input.filename,
            content: input.fileBase64,
          },
        ],
      },
    };

    const initialResponse = await fetch("https://api.runpod.ai/v2/8f62vdeuvpg10x/runsync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(inputData),
    });
    const initialResult = await initialResponse.json();

    // Extract the run ID to poll for status
    const runId = initialResult.id;
    if (!runId) {
      throw new Error("Missing run ID from the API response.");
    }

    // Polling function to check the status
    async function pollStatus() {
      const statusResponse = await fetch(`https://api.runpod.ai/v2/8f62vdeuvpg10x/status/${runId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
      });

      const statusResult = await statusResponse.json();
      console.log("Polling status:", JSON.stringify(statusResult));
      return statusResult;
    }

    // Poll until the status is COMPLETED or INCOMPLETE
    let pollResult;
    const delay = 2000;

    while (true) {
      pollResult = await pollStatus();

      if (pollResult.status === "COMPLETED") {
        console.log("Colpali ingestion completed successfully:", JSON.stringify(pollResult));
        const statusCode = pollResult.output[1];
        const error = pollResult.output[0].error;
        if (error) {
          return NextResponse.json({message: error}, {status: statusCode});
        }
        const answers = pollResult.output[0].results;
        return NextResponse.json({answers}, {status: statusCode});
      }
      if (pollResult.status === "FAILED" || pollResult.status === "CANCELLED" || pollResult.status === "TIMED_OUT") {
        console.error("Colpali ingestion failed:", JSON.stringify(pollResult));
        return NextResponse.json(
          { message: "Failed to ingest documents", status: pollResult.status },
          { status: 500 }
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } catch (error) {
    console.error("cannot analyse the documents with colpali:", error);
    return NextResponse.json({ message: 'Failed to analyse documents' }, { status: 500 });
  }
}
