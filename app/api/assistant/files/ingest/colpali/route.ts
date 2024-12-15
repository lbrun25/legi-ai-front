import {NextResponse} from "next/server";
import {getUserId} from "@/lib/supabase/utils";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input: {
    filesWithBase64: {filename: string; content: string}[];
  } = await req.json();

  try {
    const userId = await getUserId();
    const indexName = `documents_${userId}`;
    const inputData = {
      input: {
        action: "ingest",
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
      console.error("cannot ingest document:", error);
      return NextResponse.json({ message: error }, { status: statusCode });
    }
    return NextResponse.json({message: "Colpali ingested documents"});
  } catch (error) {
    console.error("cannot ingest document:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
