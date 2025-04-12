import {NextResponse} from "next/server";
import {performOcr} from "@/lib/google/ocr";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    encodedFileContent: string;
  } = await req.json();

  try {
    console.log('will make OCR');
    if (!input.encodedFileContent)
      return NextResponse.json({ message: 'Missing encodedFileContent in the body' }, { status: 400 });
    const mimeType = "application/pdf";
    const document = await performOcr(input.encodedFileContent, mimeType);
    return NextResponse.json({document});
  } catch (error) {
    console.error("cannot ingest document chunks:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
