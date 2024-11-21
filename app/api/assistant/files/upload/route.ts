import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from 'path';
import { createReadStream } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
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

    // Write file to temporary location
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(buffer));

    // Load PDF with LangChain
    const loader = new PDFLoader(tempFilePath, {
      parsedItemSeparator: "",
    });
    const docs = await loader.load();

    const chunks = await Promise.all(
      docs.map(async (doc) => {
        // Makes chunks with LangChain
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 2048,
          chunkOverlap: 256,
        });
        return textSplitter.splitText(doc.pageContent);
      })
    );

    const stream = createReadStream(tempFilePath);
    const openAiFileResponse = await openai.files.create({
      file: stream,
      purpose: 'assistants',
    });

    return NextResponse.json({
      fileId: openAiFileResponse.id,
      chunks: chunks,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  } finally {
    // Clean up the temporary file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temporary file:', unlinkError);
      }
    }
  }
}
