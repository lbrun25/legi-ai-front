"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {  DoctrinesIntermediaryPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { getMatchedDoctrines, listDoctrines } from "@/lib/ai/tools/getMatchedDoctrines";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

export const doctrinesInterpretHydeNode = async (state: typeof GraphAnnotation.State, config?: RunnableConfig,) => 
{
    console.timeEnd("Call DoctrinesInterpretHydeAgent");
    async function getDoctrineExpertMessages() {
      const doctrineExpertMessages: string[] = [];
  
      const hydeAgentMessage = state.messages.find(
        (msg) => msg.name === "HydeAgent"
      );

      if(!hydeAgentMessage?.content)
      {
        console.log("Rien encore")
      }
      
      const rankFusionIdsPromises = await getMatchedDoctrines(hydeAgentMessage?.content);
      const message = await listDoctrines(state.summary, rankFusionIdsPromises);
      doctrineExpertMessages.push(message);
      return doctrineExpertMessages;
    }
    //console.timeEnd("[DoctrinesInterpretHydeAgent] : Start searching doctrines in DB.");
    const expertDoctrinesMessages = await getDoctrineExpertMessages();
    //console.timeEnd("[DoctrinesInterpretHydeAgent] : Done searching doctrines in DB.");
  
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
      console.log("[DoctrinesInterpretHydeAgent] : Data Ready, send to LLM");
      const result = await llm.invoke(inputs, config);
      const lastMessage = result.content
      console.log("[DoctrinesInterpretHydeAgent] Response :", lastMessage);
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DoctrinesInterpretHydeAgent" }),
        ],
      };
    } catch(error) {
      console.error("error when invoking doctrinesHyde agent:", error);
      return {
        messages: [],
      }
    }
};