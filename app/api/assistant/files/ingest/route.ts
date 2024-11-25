import {getTableName, insertDocument} from "@/lib/supabase/documents";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {NextResponse} from "next/server";

const RETRY_DELAY = 2000; // Delay in milliseconds between retries

const retryableIngestion = async (
  chunk: string,
  filename: string,
  index: string
): Promise<void> => {
  while (true) {
    try {
      const tableName = await getTableName();
      const esIndexName = await ElasticsearchClient.getUserDocumentIndexName();
      const insertedDocument = await insertDocument({}, chunk, tableName, filename, index);
      if (insertedDocument) {
        await ElasticsearchClient.indexUserDocument(insertedDocument, esIndexName);
      } else {
        throw new Error(`Inserted document is null for chunk "${index}".`);
      }
      break; // Exit the loop on success
    } catch (error) {
      console.warn(`Retrying ingestion for chunk "${index}" in ${RETRY_DELAY}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

const ingestChunkForAnalysis = async (chunk: string, filename: string, index: string) => {
  // Rate limit constants
  const RATE_LIMIT_RPM = 1000; // Requests per minute
  const RATE_LIMIT_TPM = 2_000_000; // Tokens per minute
  const REQUEST_INTERVAL = 60_000 / RATE_LIMIT_RPM; // Minimum interval between requests in milliseconds

  let requestCount = 0;
  let tokenCount = 0;
  let startTime = Date.now();

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
          REQUEST_INTERVAL - elapsedTime / requestCount,
          1000 // Minimum 1 second wait
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  };

  // Estimate tokens in the chunk
  const tokens = chunk.length; // Simplified token estimation (1 char = 1 token approx.)

  // Enforce rate limits
  await enforceRateLimit(tokens);

  // Call the retryable ingestion function
  await retryableIngestion(chunk, filename, index);
};

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    chunk: string;
    filename: string;
    index: string;
  } = await req.json();

  try {
    await ingestChunkForAnalysis(input.chunk, input.filename, input.index);
    return NextResponse.json({message: "User documents chunks ingested"});
  } catch (error) {
    console.error("cannot ingest document chunks:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
