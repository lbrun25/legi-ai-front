import {NextResponse} from "next/server";
import {ChunkingMode} from "@/lib/types/chunking";
import {RecursiveCharacterTextSplitter} from "@langchain/textsplitters";
import {createSemanticChunks} from "@/lib/ai/chunking/semanticChunking";
import {google} from "@google-cloud/documentai/build/protos/protos";
import IDocument = google.cloud.documentai.v1.IDocument;
import {agenticChunking} from "@/lib/ai/chunking/agenticChunking";
import {lateChunking} from "@/lib/ai/chunking/lateChunking";

const makeChunks = async (document: IDocument, chunkingMode: ChunkingMode) => {
  const { text } = document;
  if (!text)
    throw Error(`Could not find text in document`);
  if (chunkingMode === "character") {
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
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2048,
      chunkOverlap: 256,
    });
    return await textSplitter.splitText(text);
  }
  if (chunkingMode === "semantic") {
    return await createSemanticChunks(text);
  }
  if (chunkingMode === "agentic") {
    return await agenticChunking(text);
  }
  if (chunkingMode === "contextual") {
    return await lateChunking(text, text);
  }
}

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    document: IDocument;
    chunkingMode: ChunkingMode;
  } = await req.json();

  try {
    console.log('chunkingMode:', input.chunkingMode);
    const chunks = await makeChunks(input.document, input.chunkingMode) ?? [];
    console.log('chunks:', chunks);
    return NextResponse.json({
      chunks: chunks,
    });
  } catch (error) {
    console.error("cannot make chunks:", error);
    return NextResponse.json({ message: 'Failed to make chunks' }, { status: 500 });
  }
}
