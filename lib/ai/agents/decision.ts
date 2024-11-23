"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { DecisionsThinkingAgent, DecisionAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDecisions, listDecisions, getMatchedDecisionsTool } from "@/lib/ai/tools/getMatchedDecisions";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'
import {BaseChatModel} from "@langchain/core/language_models/chat_models";

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

/* AVEC CALL TOOL SEUL */

const decisionAgent = createReactAgent({
    llm: llm as unknown as BaseChatModel,
    tools: [getMatchedDecisionsTool],
    messageModifier: new SystemMessage(DecisionAgentPrompt)
  })
  // const decisionsModel = llm.bindTools([getMatchedDecisions]);

  export const decisionAgentNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    //console.timeEnd("call DecisionAgent");
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DecisionAgentPrompt)
      .format({
        summary: state.summary
      });
    const input = [
      systemMessage,
    ]
    try {
      const result = await decisionAgent.invoke({messages: input}, config);
      console.timeEnd("call DecisionAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('DecisionAgent result:', lastMessage.content)
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "DecisionAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
};
