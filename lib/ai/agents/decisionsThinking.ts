"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { DecisionsThinkingAgent } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDecisions, listDecisions, getMatchedDecisionsTool } from "@/lib/ai/tools/getMatchedDecisions";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});


export const decisionsThinkingNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    async function removeDuplicates(numbers: bigint[]): Promise<bigint[]> {
      const uniqueNumbers = new Set(numbers);
      return Array.from(uniqueNumbers);
    }

    async function getExpertMessages() {
      const expertMessages: string[] = [];
      let rankFusionIds: bigint[] = [];

      const rankFusionIdsPromises = state.queriesDecisionsList.map(async (query) => {
        let rankFusionIdsTemp = await getMatchedDecisions(query);
        let retries = 0;
        const maxRetries = 2; // On peut ajuster cette valeur selon les besoins
        while (!rankFusionIdsTemp && retries < maxRetries) {
            await delay(100); // Attente, ajuster si nécessaire
            rankFusionIdsTemp = await getMatchedDecisions(query);
            retries++;
        }

        if (!rankFusionIdsTemp) {
            console.error(`Failed to retrieve decisions for query: ${query}`);
            return []; // ou gérer différemment selon le besoin
        }
        return rankFusionIdsTemp;
    });
      const rankFusionIdsResults = await Promise.all(rankFusionIdsPromises);
      rankFusionIdsResults.forEach(result => rankFusionIds.push(...result));
      console.time("[DecisionsThinking] : Cleaning decisions.");
      const listIds = await removeDuplicates(rankFusionIds);
      const message: any = await listDecisions(state.summary, listIds);
      console.timeEnd("[DecisionsThinking] : Cleaning decisions.");
      expertMessages.push(message);
      return expertMessages;
    }

    const expertMessages = await getExpertMessages();

    // ICI AJOTUER POUR RESUMER DETOUTE LES DECISIONS
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DecisionsThinkingAgent)
      .format({
        summary: state.summary,
      });

    const input: any = [
      systemMessage,
      ...expertMessages
    ];

    try {
      console.timeEnd("[DecisionsThinking] : Data Ready, send to LLM");
      const result = await llm.invoke(input);
      console.timeEnd("[DecisionsThinking] : invoke");
      const lastMessage = result.content
      console.log("[DecisionsThinkingAgent] Response :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DecisionsThinkingAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisionsThinkingAgent agent:", error);
      return { messages: [] }
    }
  };

