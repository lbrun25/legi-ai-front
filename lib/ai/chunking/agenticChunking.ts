import {JsonOutputParser} from "@langchain/core/output_parsers";
import {ChatOpenAI} from "@langchain/openai";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {AgenticChunkingPropositionPrompt} from "@/lib/ai/langgraph/prompt";
import {createSemanticChunks} from "@/lib/ai/chunking/semanticChunking";
import {nanoid} from "nanoid";
import {DOMImplementation, XMLSerializer} from "@xmldom/xmldom";

export const agenticChunking = async (text: string): Promise<string[]> => {
  try {
    const semanticChunks = await createSemanticChunks(text);

    // TODO: link chunk content / id to the proposition in order to cite the found chunks

    // Process each chunk in parallel to get propositions
    const propositionsPromises = semanticChunks.map(chunk => getPropositions(chunk));
    const propositionsResults = await Promise.all(propositionsPromises);
    const propositions = propositionsResults.flat();

    const agenticChunker = new AgenticChunker();

    const addPropositionPromises = propositions.map((proposition => agenticChunker.addProposition(proposition)));
    await Promise.all(addPropositionPromises);

    // agenticChunker.prettyPrintChunks();
    agenticChunker.prettyPrintChunkOutline();
    return agenticChunker.getChunks();
  } catch (error) {
    console.error("cannot make agentic chunks:", error);
    throw error;
  }
}

const getPropositions = async (chunk: string): Promise<string[]> => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", AgenticChunkingPropositionPrompt],
    ["user", `Étant donné ce chunk :\n\n${chunk}\n\nExtrais les propositions sous forme de tableau JSON de chaînes de caractères.`],
  ]);
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const outputParser = new JsonOutputParser();

  // @ts-ignore
  const chain = prompt.pipe(model).pipe(outputParser);

  const response = await chain.invoke({});
  // Check if the response is an array of strings
  if (Array.isArray(response) && response.every(item => typeof item === "string")) {
    return response as string[];
  } else {
    throw new Error("Unexpected format: getPropositions response is not an array of strings");
  }
}

type Chunk = {
  chunk_id: string;
  propositions: string[];
  title: string;
  summary: string;
  chunk_index: number;
};

class AgenticChunker {
  private chunks: Record<string, Chunk> = {};
  private idTruncateLimit: number = 5;
  private generateNewMetadata: boolean = true;
  private printLogging: boolean = true;
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });
  }

  async addProposition(proposition: string) {
    if (this.printLogging) {
      console.log(`\nAdding: '${proposition}'`);
    }

    if (Object.keys(this.chunks).length === 0) {
      if (this.printLogging) {
        console.log("No chunks, creating a new one");
      }
      await this.createNewChunk(proposition);
      return;
    }

    const chunkId = await this.findRelevantChunk(proposition);

    if (chunkId) {
      if (this.printLogging) {
        console.log(
          `Chunk Found (${this.chunks[chunkId].chunk_id}), adding to: ${this.chunks[chunkId].title}`
        );
      }
      await this.addPropositionToChunk(chunkId, proposition);
    } else {
      if (this.printLogging) {
        console.log("No chunks found, creating a new one");
      }
      await this.createNewChunk(proposition);
    }
  }

  private async addPropositionToChunk(chunkId: string, proposition: string): Promise<void> {
    this.chunks[chunkId].propositions.push(proposition);

    if (this.generateNewMetadata) {
      this.chunks[chunkId].summary = await this.updateChunkSummary(this.chunks[chunkId]);
      this.chunks[chunkId].title = await this.updateChunkTitle(this.chunks[chunkId]);
    }
  }

  private async updateChunkSummary(chunk: Chunk): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
      Vous êtes responsable de la mise à jour des résumés des chunks. Générez un résumé en une phrase pour le chunk donné.
      Généralisez les sujets si nécessaire. Exemple :
      Proposition : "Greg aime manger de la pizza"
      Résultat : "Ce chunk contient des informations sur les types de nourriture que Greg aime manger."
    `,
      ],
      ["user", `Propositions du chunk :\n${chunk.propositions.join("\n")}\n\nRésumé actuel :\n${chunk.summary}`],
    ]);
    // @ts-ignore
    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({});
    return response?.content as string || "";
  }

  private async updateChunkTitle(chunk: Chunk): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
      Générez un titre concis pour le chunk donné. Les titres doivent généraliser les sujets. Exemple :
      Résumé : "Ce chunk concerne les dates et heures mentionnées par l'auteur"
      Résultat : "Dates & Heures"
    `,
      ],
      [
        "user",
        `Propositions du chunk :\n${chunk.propositions.join("\n")}\n\nRésumé du chunk :\n${chunk.summary}\n\nTitre actuel :\n${chunk.title}`,
      ],
    ]);
    // @ts-ignore
    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({});
    return response?.content as string || "";
  }

  private async createNewChunk(proposition: string) {
    const newChunkId = nanoid(this.idTruncateLimit);
    const newChunkSummary = await this.getNewChunkSummary(proposition);
    const newChunkTitle = await this.getNewChunkTitle(newChunkSummary);

    this.chunks[newChunkId] = {
      chunk_id: newChunkId,
      propositions: [proposition],
      title: newChunkTitle,
      summary: newChunkSummary,
      chunk_index: Object.keys(this.chunks).length,
    };

    if (this.printLogging) {
      console.log(`Created new chunk (${newChunkId}): ${newChunkTitle}`);
    }
  }

  private async getNewChunkSummary(proposition: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
      Générez un résumé en une phrase pour le nouveau chunk. Généralisez lorsque cela est approprié. Exemple :
      Proposition : "Greg aime manger de la pizza"
      Résultat : "Ce chunk contient des informations sur les types de nourriture que Greg aime manger."
    `,
      ],
      ["user", `Proposition :\n${proposition}`],
    ]);
    // @ts-ignore
    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({});
    return response?.content as string || "";
  }

  private async getNewChunkTitle(summary: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
      Générez un titre bref pour le résumé du chunk donné. Généralisez lorsque cela est approprié. Exemple :
      Résumé : "Ce chunk concerne les dates et heures mentionnées par l'auteur"
      Résultat : "Dates & Heures"
    `,
      ],
      ["user", `Résumé :\n${summary}`],
    ]);
    // @ts-ignore
    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({});
    return response?.content as string || "";
  }

  private async findRelevantChunk(proposition: string): Promise<string | null> {
    const currentChunkOutline = this.getChunkOutline();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
      Déterminez si la proposition donnée appartient à un chunk existant. Retournez l'ID du chunk si elle correspond, sinon retournez "Aucun chunk".
    `,
      ],
      ["user", `Proposition :\n${proposition}\n\nChunks :\n${currentChunkOutline}`],
    ]);
    // @ts-ignore
    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({});
    return response?.content as string || null;
  }

  prettyPrintChunks(): void {
    console.log(`\nYou have ${Object.keys(this.chunks).length} chunks\n`);
    for (const [chunkId, chunk] of Object.entries(this.chunks)) {
      console.log(`Chunk #${chunk.chunk_index}`);
      console.log(`Chunk ID: ${chunkId}`);
      console.log(`Summary: ${chunk.summary}`);
      console.log(`Propositions:`);
      for (const prop of chunk.propositions) {
        console.log(`    - ${prop}`);
      }
      console.log("\n\n");
    }
  }

  prettyPrintChunkOutline(): void {
    console.log("Chunk Outline\n");
    console.log(this.getChunkOutline());
  }

  /**
   * Get a string representing the current chunks.
   * This will be empty when you first start off.
   */
  getChunkOutline(): string {
    let chunkOutline = "";

    for (const [chunkId, chunk] of Object.entries(this.chunks)) {
      const singleChunkString = `Chunk ID: ${chunk.chunk_id}\nChunk Name: ${chunk.title}\nChunk Summary: ${chunk.summary}\n\n`;
      chunkOutline += singleChunkString;
    }

    return chunkOutline;
  }

  getChunks(): string[] {
    const chunks: string[] = [];

    for (const chunk of Object.values(this.chunks)) {
      chunks.push(chunk.propositions.join(" "));
    }

    return chunks;
  }

  /**
   * Convert a chunk into an XML representation.
   * Includes all attributes of the chunk and appends propositions as child elements.
   */
  convertChunkToXML(chunk: Chunk): string {
    const domImplementation = new DOMImplementation();
    const document = domImplementation.createDocument(null, "documents", null);
    const rootElement = document.documentElement;

    if (!rootElement) return "";

    const chunkElement = document.createElement("chunk");

    // const contentElement = document.createElement("content");
    // contentElement.textContent = chunk.content;
    // chunkElement.appendChild(contentElement);

    const titleElement = document.createElement("title");
    titleElement.textContent = chunk.title;
    chunkElement.appendChild(titleElement);

    const summaryElement = document.createElement("summary");
    summaryElement.textContent = chunk.summary;
    chunkElement.appendChild(summaryElement);

    // Add propositions as child elements
    const propositionsElement = document.createElement("propositions");
    for (const proposition of chunk.propositions) {
      const propositionElement = document.createElement("proposition");
      propositionElement.textContent = proposition;
      propositionsElement.appendChild(propositionElement);
    }
    chunkElement.appendChild(propositionsElement);

    // Append the chunk to the root
    rootElement.appendChild(chunkElement);

    // Serialize the document to an XML string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(document);
  }
}
