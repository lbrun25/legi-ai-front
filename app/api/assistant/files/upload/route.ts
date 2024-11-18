import { NextResponse } from 'next/server';
import fs from 'fs';
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { checkUserDocumentTable, insertDocument } from "@/lib/supabase/documents";
import { ElasticsearchClient } from "@/lib/elasticsearch/client";
import { CharacterTextSplitter } from "@langchain/textsplitters";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const ingestDocumentForAnalysis = async (filePath: string, file: File) => {
  // Load PDF with LangChain
  const loader = new PDFLoader(filePath, {
    parsedItemSeparator: "",
  });
  const docs = await loader.load();

  const tableName = await checkUserDocumentTable();
  const esIndexName = await ElasticsearchClient.checkUserDocumentIndex();

  // Process each document in parallel
  await Promise.all(
    docs.map(async (doc, indexDocument) => {
      // Makes chunks with LangChain
      const textSplitter = new CharacterTextSplitter({
        chunkSize: 400,
        separator: " ",
        chunkOverlap: 80,
      });

      const chunks = await textSplitter.splitText(doc.pageContent);

      // Process chunks in parallel
      const chunkPromises = chunks.map(async (chunk, indexChunk) => {
        const index = `${indexDocument}-${indexChunk}`;
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
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    const tempFilePath = `/tmp/${file.name}`;
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // Upload to OpenAI
    const response = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    // Check if the file is a PDF by extension
    if (file.name.toLowerCase().endsWith('.pdf')) {
      await ingestDocumentForAnalysis(tempFilePath, file);
    }

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    // Return the OpenAI file ID
    return NextResponse.json(response);
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
