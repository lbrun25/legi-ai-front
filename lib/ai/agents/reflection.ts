"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ReflectionAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });

  // ReflectionAgent
const reflectionPrompt = ChatPromptTemplate.fromMessages([
    ["system", ReflectionAgentPrompt],
    new MessagesPlaceholder("messages"),
])

const summaryTool = {
    name: "summary",
    description: "Établit un sommaire de la demande de l'utilisateur",
    schema: z.object({
      summary: z.string(),
    }),
}

export const reflectionChain = reflectionPrompt
  .pipe(llm.bindTools([summaryTool]))
  .pipe((x) => {
    console.timeEnd("call reflectionAgent");
    const appel = JSON.stringify(x, null, 2)
    const xParsed = JSON.parse(appel);
    if (xParsed.kwargs.tool_call_chunks.length === 0) {
      console.log("tool_call_chunks est vide."); // Summary pas appelé
      console.log("x:", x.content); // => Contenu message agent
      x.content = "[IMPRIMER]" + x.content;
      return (x)
    } else {
      if (xParsed.kwargs.tool_calls.length > 0) {
        const summary = xParsed.kwargs.tool_calls[0].args.summary; // Contient le sommaire fait par l'agent
        console.log("Le summary est :", summary);
        return {summary: summary}
      } else {
        x.content = "[IMPRIMER]" + x.content;
        console.log("tool_calls est vide.");
        return (x);
      }
    }
});