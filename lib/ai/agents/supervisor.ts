"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { SupervisorPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'
import { route } from "@/lib/ai/tools/route";
import { stat } from "fs";

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

const supervisorAgent = createReactAgent({
    llm,
    tools: [route], // avoir ou sens
    messageModifier: new SystemMessage(SupervisorPrompt)
})

export const supervisorNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {

    const str = state.subQuestions[0]
    console.log("SubQuestion : ", state.subQuestions[0])
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(SupervisorPrompt)
      .format({
        summary: str
    });

    const input: any = [
      systemMessage,
    ];

    try {
      console.log("[SupervisorAgent] : Data ready, send to LLM.");
      const result = await supervisorAgent.invoke({messages: input}, config);
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("Agents Selected by Supervisor :", state.nexts)
      console.log('SupervisorAgent result:', lastMessage.content)
      //console.timeEnd("[SupervisorAgent] : invoke");
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "SupervisorAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking planner agent:", error);
      return { messages: [] }
    }
};