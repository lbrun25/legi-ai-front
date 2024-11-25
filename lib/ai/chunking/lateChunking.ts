import {createSemanticChunks} from "@/lib/ai/chunking/semanticChunking";
import {PromptTemplate} from "@langchain/core/prompts";
import {ContextualChunkingPrompt} from "@/lib/ai/langgraph/prompt";
import OpenAI from "openai";
import {DOMImplementation, XMLSerializer} from "@xmldom/xmldom";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const convertContextualToXml = (chunkContent: string, context: string) => {
  const domImplementation = new DOMImplementation();
  const document = domImplementation.createDocument(null, "chunk", null);
  const rootElement = document.documentElement;

  if (!rootElement) return "";

  const contentElement = document.createElement("content");
  contentElement.textContent = chunkContent;
  rootElement.appendChild(contentElement);

  const contextElement = document.createElement("context");
  contextElement.textContent = context;
  rootElement.appendChild(contextElement);

  // Serialize the document to an XML string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(document);
};

const contextualChunk = async (chunk: string, document: string) => {
  const prompt = new PromptTemplate({
    template: ContextualChunkingPrompt,
    inputVariables: ['WHOLE_DOCUMENT', 'CHUNK_CONTENT'],
  });
  const formattedPrompt = await prompt.format({
    WHOLE_DOCUMENT: document,
    CHUNK_CONTENT: chunk,
  });
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: formattedPrompt }],
    model: 'gpt-4o-mini',
  });
  const situatedText = chatCompletion.choices[0].message.content;
  if (!situatedText) {
    console.error("cannot situate chunk:", chunk);
  }
  return convertContextualToXml(chunk, situatedText || "");
}

// lateChunking is the contextual chunking (pass the entire document in order to situate the chunk)
export const lateChunking = async (text: string, document: string): Promise<string[]> => {
  const semanticChunks = await createSemanticChunks(text);
  const chunkPromises = semanticChunks.map(chunk => contextualChunk(chunk, document));
  return await Promise.all(chunkPromises);
}
