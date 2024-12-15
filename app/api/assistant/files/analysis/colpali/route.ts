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
      console.error("cannot analyse the documents with colpali:", error);
      return NextResponse.json({ message: error }, { status: statusCode });
    }
    const answers = result.output[0].results;
    return NextResponse.json({answers});
  } catch (error) {
    console.error("cannot analyse the documents with colpali:", error);
    return NextResponse.json({ message: 'Failed to analyse documents' }, { status: 500 });
  }
}
