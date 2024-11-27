import {NextResponse} from "next/server";
import {DocumentProcessorServiceClient} from "@google-cloud/documentai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const docGoogleAiClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    project_id: process.env.GCP_PROJECT_ID,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g,"\n"),
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  },
});

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    encodedFileContent: string;
  } = await req.json();

  try {
    if (!input.encodedFileContent)
      return NextResponse.json({ message: 'Missing encodedFileContent in the body' }, { status: 400 });
    const projectNumber = process.env.GCP_PROJECT_NUMBER;
    const location = process.env.GCP_PROJECT_LOCATION || 'eu';
    const processorId = process.env.GCP_PROCESSOR_ID || '';
    const name = `projects/${projectNumber}/locations/${location}/processors/${processorId}`;
    const request = {
      name,
      rawDocument: {
        content: input.encodedFileContent,
        mimeType: 'application/pdf',
      },
    };
    const [result] = await docGoogleAiClient.processDocument(request);
    const { document } = result;

    if (!document || !document.pages) {
      console.error("no document were processed by Google Document AI");
      return NextResponse.json({ message: 'no document were processed' }, { status: 500 });
    }
    return NextResponse.json({document});
  } catch (error) {
    console.error("cannot ingest document chunks:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
