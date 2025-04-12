"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { HydeAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'
import {BaseChatModel} from "@langchain/core/language_models/chat_models";

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });

const hydeAgent = createReactAgent({
    llm: llm as unknown as BaseChatModel,
    tools: [],
    messageModifier: new SystemMessage(HydeAgentPrompt)
  })
  // const decisionsModel = llm.bindTools([getMatchedDecisions]);
export const hydeNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    //console.log('LES SUBQUESTIONS:', state.subQuestions)
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(HydeAgentPrompt)
      .format({
        summary: state.summary
      });

    const input = [
      systemMessage,
    ]

    try {
      const result = await hydeAgent.invoke({messages: input}, config);
      //console.timeEnd("call hydeAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      //console.log('[HydeAgent] Response :', lastMessage.content)
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "HydeAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
};
