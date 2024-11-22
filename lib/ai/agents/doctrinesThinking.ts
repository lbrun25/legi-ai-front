"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { DoctrinesIntermediaryPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation } from '@/lib/ai/langgraph/graph'
import { getMatchedArticles, articlesCleaned, getMatchedArticlesTool } from "@/lib/ai/tools/getMatchedArticles";
import { getMatchedDoctrines, listDoctrines } from "@/lib/ai/tools/getMatchedDoctrines";
import { getArticleByNumberTool, getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";
import { mergeResults } from '@/lib/utils/mergeResults'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

export const doctrinesIntermediaryNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("Call doctrinesThinkingAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    async function removeDuplicates(numbers: bigint[]): Promise<bigint[]> {
      const uniqueNumbers = new Set(numbers);
      return Array.from(uniqueNumbers);
    }

    async function getDoctrineExpertMessages() {
      const doctrineExpertMessages: string[] = [];
      let rankFusionIdsDoctrine: bigint[] = [];

      const rankFusionIdsPromises = state.requestDoctrines.map(async (query) => {
        let rankFusionIdsTemp = await getMatchedDoctrines(query);
        if (!rankFusionIdsTemp) {
          await delay(100);
          rankFusionIdsTemp = await getMatchedDoctrines(query);
        }
        return rankFusionIdsTemp;
      });

      // Attente que toutes les promesses soient terminées
      const rankFusionIdsResults = await Promise.all(rankFusionIdsPromises);
      // Regroupement de tous les résultats dans un seul tableau
      rankFusionIdsResults.forEach(result => rankFusionIdsDoctrine.push(...result));
      // Suppression des doublons
      const doctrineListIds = await removeDuplicates(rankFusionIdsDoctrine);
      //console.log("After doctrines dupplicates removed :", doctrineListIds)
      const message = await listDoctrines(state.summary, doctrineListIds);
      doctrineExpertMessages.push(message);

      return doctrineExpertMessages;
    }

    console.timeEnd("[DoctrinesThinkingAgent] : Start searching doctrines in DB.");
    const expertDoctrinesMessages = await getDoctrineExpertMessages();
    console.timeEnd("[DoctrinesThinkingAgent] : Done searching doctrines in DB.");

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DoctrinesIntermediaryPrompt)
      .format({
        summary: state.summary,
      });

    const inputs = [
      systemMessage,
      ...expertDoctrinesMessages
    ]

    try {
      //console.timeEnd("[DoctrinesThinking] : Data Ready, send to LLM");
      //console.log("[DoctrinesThinkingAgents] inputs : ", inputs)
      const result = await llm.invoke(inputs, config);
      console.timeEnd("[DoctrinesThinking] : invoke")
      const lastMessage = result.content
      console.log("[DoctrinesThinkingAgents] Content :", lastMessage);
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DoctrinesThinkingAgent" }),
        ],
      };
    } catch(error) {
      console.error("error when invoking doctrines agent:", error);
      return {
        messages: [],
      }
    }
};