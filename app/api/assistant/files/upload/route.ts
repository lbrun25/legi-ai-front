import {NextResponse} from 'next/server';
import fs from 'fs/promises';
import OpenAI from "openai";
import {RecursiveCharacterTextSplitter} from "@langchain/textsplitters";
import path from 'path';
import {createReadStream} from 'fs';
import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import { PDFDocument } from 'pdf-lib'
import {getGCPCredentials} from "@/lib/google/gcp";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const docGoogleAiClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
  ...getGCPCredentials
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
    tempFilePath = path.join(tempDir, file.name);

    const projectId = "739114993089";
    const location = process.env.GOOGLE_CLOUD_PROJECT_LOCATION || 'eu';
    const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID || '';
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Split the PDF into chunks of 15 pages
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = pdfDoc.getPageCount();
    const MAX_PAGES = 15;

    let allChunks: string[][] = [];

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

      const { text } = document;

      if (!text) {
        console.error("no texts were processed for the OCR");
        continue;
      }
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2048,
        chunkOverlap: 256,
      });
      const chunks = await textSplitter.splitText(text);

      // Extract shards from the text field
      // const getText = (textAnchor) => {
      //   if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
      //     return '';
      //   }
      //
      //   const startIndex = textAnchor.textSegments[0].startIndex || 0;
      //   const endIndex = textAnchor.textSegments[0].endIndex;
      //
      //   return text.substring(startIndex, endIndex);
      // };
      //
      // const chunks = await Promise.all(
      //   document.pages.map(async (page) => {
      //     const paragraphChunks = await Promise.all(
      //       page.paragraphs?.map(async (paragraph) => {
      //         const textAnchor = paragraph?.layout?.textAnchor;
      //         const text = getText(textAnchor);
      //         const textSplitter = new RecursiveCharacterTextSplitter({
      //           chunkSize: 2048,
      //           chunkOverlap: 256,
      //         });
      //         return textSplitter.splitText(text);
      //       }) || []
      //     );
      //     return paragraphChunks.flat(); // Flatten paragraph chunks into a single array for the page
      //   })
      // );

      allChunks.push(chunks); // Append chunks for the current document to allChunks
    }

    console.log('chunks:', allChunks);

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
      chunks: allChunks,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
