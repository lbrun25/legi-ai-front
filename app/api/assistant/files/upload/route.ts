import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { checkUserDocumentTable, insertDocument } from "@/lib/supabase/documents";
import { ElasticsearchClient } from "@/lib/elasticsearch/client";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from 'path';
import { createReadStream } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const ingestDocumentForAnalysis = async (filePath: string, file: File) => {
  // Rate limit constants
  const RATE_LIMIT_RPM = 1000; // Requests per minute
  const RATE_LIMIT_TPM = 2_000_000; // Tokens per minute
  const REQUEST_INTERVAL = 60_000 / RATE_LIMIT_RPM; // Minimum interval between requests in milliseconds

  let requestCount = 0;
  let tokenCount = 0;
  let startTime = Date.now();

  // Load PDF with LangChain
  const loader = new PDFLoader(filePath, {
    parsedItemSeparator: "",
  });
  const docs = await loader.load();

  const tableName = await checkUserDocumentTable();
  const esIndexName = await ElasticsearchClient.checkUserDocumentIndex();

  // Function to wait for rate limits
  const enforceRateLimit = async (tokens: number) => {
    requestCount++;
    tokenCount += tokens;

    // Check if we've exceeded RPM
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > 60_000) {
      // Reset counters every minute
      startTime = Date.now();
      requestCount = 0;
      tokenCount = 0;
    } else {
      // Enforce delays based on RPM or TPM
      if (requestCount >= RATE_LIMIT_RPM || tokenCount >= RATE_LIMIT_TPM) {
        const waitTime = Math.max(
          REQUEST_INTERVAL - (elapsedTime / requestCount),
          1000 // Minimum 1 second wait
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  };

  // Process each document in parallel
  await Promise.all(
    docs.map(async (doc, indexDocument) => {
      // Makes chunks with LangChain
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2048,
        chunkOverlap: 256,
      });

      const chunks = await textSplitter.splitText(doc.pageContent);

      // Process chunks in parallel
      const chunkPromises = chunks.map(async (chunk, indexChunk) => {
        const index = `${indexDocument}-${indexChunk}`;

        // Estimate tokens in the chunk
        const tokens = chunk.length; // Simplified token estimation (1 char = 1 token approx.)

        // Enforce rate limits
        await enforceRateLimit(tokens);

        // Call the embedding API
        const insertedDocument = await insertDocument(doc, chunk, tableName, file.name, index);
        if (insertedDocument) {
          await ElasticsearchClient.indexUserDocument(insertedDocument, esIndexName);
        } else {
          console.error(
            `Document chunk "${index}" failed to index because the inserted document from Supabase is null.`
          );
        }
      });

      // Wait for all chunks of the current document to finish
      await Promise.all(chunkPromises);
    })
  );

  console.log("All documents and chunks processed successfully.");
};

export async function POST(req: Request) {
  const tempDir = '/tmp';
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    tempFilePath = path.join(tempDir, file.name);

    // Write file to temporary location
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(buffer));

    // Check if the file is a PDF by extension
    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Ensure the document is ingested before the file is deleted
      await ingestDocumentForAnalysis(tempFilePath, file);
    }

    let response;
    try {
      // Upload to OpenAI
      const stream = createReadStream(tempFilePath);
      response = await openai.files.create({
        file: stream,
        purpose: 'assistants',
      });
    } catch (uploadError) {
      console.error('Error uploading file to OpenAI:', uploadError);
      throw uploadError;
    }

    // Return the OpenAI file ID
    return NextResponse.json(response);
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
