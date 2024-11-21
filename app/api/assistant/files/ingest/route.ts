import {checkUserDocumentTable, insertDocument} from "@/lib/supabase/documents";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {RecursiveCharacterTextSplitter} from "@langchain/textsplitters";
import {NextResponse} from "next/server";

const ingestChunksForAnalysis = async (chunks: string[], filename: string) => {
  // Rate limit constants
  const RATE_LIMIT_RPM = 1000; // Requests per minute
  const RATE_LIMIT_TPM = 2_000_000; // Tokens per minute
  const REQUEST_INTERVAL = 60_000 / RATE_LIMIT_RPM; // Minimum interval between requests in milliseconds

  let requestCount = 0;
  let tokenCount = 0;
  let startTime = Date.now();

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

  const chunkPromises = chunks.map(async (chunk, indexChunk) => {
    // TODO: insert page index to index
    const index = `${indexChunk}`;

    // Estimate tokens in the chunk
    const tokens = chunk.length; // Simplified token estimation (1 char = 1 token approx.)

    // Enforce rate limits
    await enforceRateLimit(tokens);

    // Call the embedding API
    const insertedDocument = await insertDocument({}, chunk, tableName, filename, index);
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

  console.log("All documents and chunks processed successfully.");
};

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    chunks: string[];
    filename: string;
  } = await req.json();

  try {
    await ingestChunksForAnalysis(input.chunks, input.filename);
    return NextResponse.json({message: "User documents chunks ingested"});
  } catch (error) {
    console.log("cannot ingest document chunks:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
