import {getUserDocumentsByIds, MatchedUserDocument} from "@/lib/supabase/documents";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";
import {UserDocument} from "@/lib/types/document";
import {DOMImplementation, XMLSerializer} from "@xmldom/xmldom";
import {PDFDocument} from "pdf-lib";
import {UnstructuredTableElement} from "@/lib/types/table";
import {ChunkingMode} from "@/lib/types/chunking";
import {google} from "@google-cloud/documentai/build/protos/protos";
import IDocument = google.cloud.documentai.v1.IDocument;

interface UserDocumentPrecision {
  relevance_score: number;
  index: number;
}

export const getMatchedUserDocuments = async (input: string, semanticResponse: MatchedUserDocument[], bm25Results: any) => {
  const semanticIds = semanticResponse.map((doc) => doc.id);
  const bm25Ids = bm25Results.map((doc: any) => doc.id);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 80, 0.5, 0.5);
  const listIDs = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  const docsToRank = await getUserDocumentsByIds(listIDs);
  const docsContent = docsToRank?.map(article => article.content) || [];
  if (!docsToRank) {
    console.warn("no docs to rank.");
    return ""
  }
  const docsRanked: any = await rerankWithVoyageAI(input, docsContent);
  console.log("docsRanked", docsRanked);
  const filteredDocs: any = docsRanked.data.filter((doc: UserDocumentPrecision) => doc.relevance_score >= 0.2);
  const indexes = filteredDocs.map((doc: UserDocumentPrecision) => doc.index).reverse();
  const orderedDocs = indexes.map((index: number) => docsToRank[index]);
  console.log("orderedDocs:", orderedDocs);
  if (!orderedDocs){
    console.warn("no ordered docs.");
    return "";
  }
  return convertUserDocumentsToXML(orderedDocs);
}

const convertUserDocumentsToXML = (userDocuments: Omit<UserDocument, "embedding_openai" | "embedding_voyage">[]) => {
  const domImplementation = new DOMImplementation();
  const title = `chunks`;
  const document = domImplementation.createDocument(null, title, null);
  const rootElement = document.documentElement;
  if (!rootElement) return "";

  userDocuments.forEach(doc => {
    const chunkElement = document.createElement('chunk');

    const contentElement = document.createElement('content');
    contentElement.textContent = doc.content;
    chunkElement.appendChild(contentElement);

    rootElement.appendChild(chunkElement);
  });
  const serializer = new XMLSerializer();
  return serializer.serializeToString(document);
}


export const createChunksForFile = async (file: File, chunkingMode: ChunkingMode) => {
  const formData = new FormData();
  formData.append('file', file);

  // PDF splitting
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const totalPages = pdfDoc.getPageCount();
  const maxPages = 15;

  const splitTasks = Array.from({length: Math.ceil(totalPages / maxPages)}, (_, index) => {
    const startPage = index * maxPages;
    const endPage = Math.min((index + 1) * maxPages, totalPages);

    return async () => {
      const subPdf = await PDFDocument.create();
      const pages = await subPdf.copyPages(pdfDoc, Array.from({length: endPage - startPage}, (_, j) => startPage + j));
      pages.forEach((page) => subPdf.addPage(page));

      const chunkBuffer = await subPdf.save();
      return Buffer.from(chunkBuffer).toString('base64');
    };
  });
  const allEncodedDocument = await Promise.all(splitTasks.map((task) => task()));

  const documents = await Promise.all(
    allEncodedDocument.map(async (encodedFileContent: string) => {
      const ocrResponse = await fetch('/api/assistant/files/ocr', {
        method: 'POST',
        body: JSON.stringify({
          encodedFileContent,
        }),
      });
      const ocrResult = await ocrResponse.json();
      return ocrResult.document;
    })
  );

  const chunksResponses = await Promise.all(
    documents.map(async (doc: IDocument) => {
      const {text: documentText} = doc;
      if (!documentText)
        throw Error(`Could not find text in document`);
      const chunksResponse = await fetch('/api/assistant/files/chunks', {
        method: 'POST',
        body: JSON.stringify({
          documentText,
          chunkingMode
        }),
      });
      const chunksResult = await chunksResponse.json();
      return chunksResult.chunks;
    })
  );

  const chunks = chunksResponses.flat();

  try {
    // Table chunks with Unstructured. Chunking by row by adding table headers and contextual.
    const unstructuredResponse = await fetch('/api/assistant/files/unstructured/partition', {
      method: 'POST',
      body: formData,
    });
    const unstructuredResponseResult = await unstructuredResponse.json();
    const unstructuredTables: UnstructuredTableElement[] = unstructuredResponseResult.tables;

    const tableChunksResponses = await Promise.all(
      unstructuredTables.map(async (unstructuredTable) => {
        try {
          const tableChunksResponse = await fetch('/api/assistant/files/chunks/table', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              table: unstructuredTable,
            }),
          });
          const tableChunksResult = await tableChunksResponse.json();
          return tableChunksResult.chunks;
        } catch (error) {
          console.error("cannot make chunks for table:", error);
        }
      })
    );
    const tableChunks = tableChunksResponses.flat();
    chunks.push(...tableChunks);
  } catch (error) {
    console.error("cannot make chunks for table:", error);
  }
  return chunks;
}

export async function ingestChunks(
  chunks: string[],
  fileName: string,
  onChunkIngested: (chunkIndex: number) => void
) {
  await Promise.all(
    chunks.map(async (chunk: string, chunkIndex: number) => {
      try {
        // Send chunk to the server
        const ingestResponse = await fetch('/api/assistant/files/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chunk: chunk,
            filename: fileName,
            index: chunkIndex,
          }),
        });

        if (!ingestResponse.ok) {
          console.error(`Failed to ingest chunk at index ${chunkIndex}:`, chunk);
        } else {
          // Invoke the callback after successfully processing the chunk
          onChunkIngested(chunkIndex);
        }
      } catch (error) {
        console.error(`Error ingesting chunk at index ${chunkIndex}:`, error);
      }
    })
  );
}
