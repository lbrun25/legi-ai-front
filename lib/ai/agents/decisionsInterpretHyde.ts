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

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

// AJOUTER SI TIME OUT RETRY MAX 3
export const decisionsInterpretHydeNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    //console.timeEnd("call DecisionsInterpretHydeAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const hydeAgentMessage = state.messages.find(
      (msg) => msg.name === "HydeAgent"
    );

    async function getExpertMessages() {
      const expertMessages: string[] = [];
      const rankFusionIdsPromises = await getMatchedDecisions(hydeAgentMessage?.content);
      const message: any = await listDecisions(state.summary, rankFusionIdsPromises);
      console.timeEnd("[DecisionsInterpretHydeAgent] : Cleaning decisions.");
      expertMessages.push(message);
      return expertMessages;
    }

    const expertMessages = await getExpertMessages();
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
      console.timeEnd("[DecisionsInterpretHydeAgent] : Data Ready, send to LLM");
      const result = await llm.invoke(input);
      console.timeEnd("[DecisionsInterpretHydeAgent] : invoke");
      const lastMessage = result.content
      console.log("DecisionsInterpretHydeAgent Content :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DecisionsInterpretHydeAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking DecisionsInterpretHydeAgent agent:", error);
      return { messages: [] }
    }
};
