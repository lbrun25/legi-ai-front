import {ElasticsearchClient} from "@/lib/elasticsearch/client";
import {getUserDocumentsByIds, searchMatchedUserDocuments} from "@/lib/supabase/documents";
import {rankFusion} from "@/lib/utils/rank-fusion";
import {rerankWithVoyageAI} from "@/lib/ai/voyage/reRankers";
import {UserDocument} from "@/lib/types/document";
import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {DOMImplementation, XMLSerializer} from '@xmldom/xmldom';

const NUM_RELEVANT_CHUNKS = 150;

interface UserDocumentPrecision {
  relevance_score: number;
  index: number;
}

export const getMatchedUserDocumentsTool = tool(async (input) => {
  if (!input.query) return "";
  return await getMatchedUserDocuments(input.query);
}, {
  name: 'getMatchedUserDocuments',
  description: "Utilise ce tool pour répondre aux questions spécifiques d'un utilisateur sur son document. Il récupère les informations liées au document pour fournir une réponse détaillée.",
  schema: z.object({
    query: z.string().describe("Question de l'utilisateur à propos du document."),
  })
})

const getMatchedUserDocuments = async (input: string) => {
  const semanticResponse = await searchMatchedUserDocuments(input);
  console.log('semanticResponse:', semanticResponse);
  const bm25Results = await ElasticsearchClient.searchUserDocuments(input, NUM_RELEVANT_CHUNKS);
  // console.log('bm25Results:', bm25Results);
  if (semanticResponse.length === 0 || bm25Results.length === 0)
    return "";
  const semanticIds = semanticResponse.map((doc) => doc.id);
  const bm25Ids = bm25Results.map((doc: any) => doc.id);
  const rankFusionResult = rankFusion(semanticIds, bm25Ids, 80, 0.5, 0.5);
  const listIDs = rankFusionResult.results.filter(result => result.score > 0).map(result => result.id);
  const docsToRank = await getUserDocumentsByIds(listIDs);
  const docsContent = docsToRank?.map(article => article.content) || [];
  if (!docsToRank) return "";
  const docsRanked: any = await rerankWithVoyageAI(input, docsContent);
  console.log("docsRanked", docsRanked);
  const filteredDocs: any = docsRanked.data.filter((doc: UserDocumentPrecision) => doc.relevance_score >= 0.4);
  const indexes = filteredDocs.map((doc: UserDocumentPrecision) => doc.index).reverse();
  const orderedDocs = indexes.map((index: number) => docsToRank[index]);
  console.log("orderedDocs:", orderedDocs);
  if (!orderedDocs) return "";
  try {
    convertUserDocumentsToXML(orderedDocs)
  } catch (error) {
    console.error("cannot create xml:", error)
  }
  const xml = convertUserDocumentsToXML(orderedDocs);
  return convertUserDocumentsToXML(orderedDocs);
}

const convertUserDocumentsToXML = (userDocuments: Omit<UserDocument, "embedding_openai" | "embedding_voyage">[]) => {
  const domImplementation = new DOMImplementation();
  const title = `documents`;
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
