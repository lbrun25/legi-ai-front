import {NextResponse} from 'next/server';
import fs from 'fs/promises';
import OpenAI from "openai";
import path from 'path';
import {createReadStream} from 'fs';
import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import {PDFDocument} from 'pdf-lib'
import {google} from "@google-cloud/documentai/build/protos/protos";
import IDocument = google.cloud.documentai.v1.IDocument;

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
  const tempDir = '/tmp';
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ message: 'Unsupported files: Support only PDFs' }, { status: 400 });
    }
    console.log(`will upload file ${file.name}`);
    tempFilePath = path.join(tempDir, file.name);

    const projectNumber = process.env.GCP_PROJECT_NUMBER;
    const location = process.env.GCP_PROJECT_LOCATION || 'eu';
    const processorId = process.env.GCP_PROCESSOR_ID || '';
    const name = `projects/${projectNumber}/locations/${location}/processors/${processorId}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Split the PDF into chunks of 15 pages
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = pdfDoc.getPageCount();
    const MAX_PAGES = 15;

    let allDocuments: IDocument[] = [];

    for (let i = 0; i < totalPages; i += MAX_PAGES) {
      console.log('will process page:', i)
      const subPdf = await PDFDocument.create();
      const startPage = i;
      const endPage = Math.min(i + MAX_PAGES, totalPages);

      const pages = await subPdf.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, j) => startPage + j));
      pages.forEach((page) => subPdf.addPage(page));

      const chunkBuffer = await subPdf.save();
      const encodedFileContent = Buffer.from(chunkBuffer).toString('base64');

      const request = {
        name,
        rawDocument: {
          content: encodedFileContent,
          mimeType: 'application/pdf',
        },
      };

      // Process the document with Google Document AI
      const [result] = await docGoogleAiClient.processDocument(request);
      const { document } = result;

      if (!document || !document.pages) {
        console.error("no document were processed by Google Document AI");
        continue; // Skip if no pages were processed
      }
      allDocuments.push(document);
    }

    // Write file to temporary location
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(buffer));
    const stream = createReadStream(tempFilePath);
    const openAiFileResponse = await openai.files.create({
      file: stream,
      purpose: 'assistants',
    });

    return NextResponse.json({
      fileId: openAiFileResponse.id,
      documents: allDocuments,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
