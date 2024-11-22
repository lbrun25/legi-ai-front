"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PlannerAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'
//import { subQuestionsTool } from "@/lib/ai/tools/subQuestions";

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

/* CONTROLER QU'IL RECOIT BIEN LE BON MESSAGE CAR LA IL ME SEMBLE QUE RECOIT LE SUMMARY MAIS PAS SUR */

const plannerPrompt = ChatPromptTemplate.fromMessages([
    ["system", PlannerAgentPrompt], // Votre prompt spécifique pour ArticlesAgent
    new MessagesPlaceholder("messages"),
]);

// Définition de l'outil pour ArticlesAgent
const subQuestionsTool = {
    name: "subQuestions",
    description: "Liste des sous-questions issues de la demande de l'utilisateur",
    schema: z.object({
      subQuestions: z.array(z.string()),
    }),
};

//BreakDown in question
export const plannerChain = plannerPrompt
.pipe(llm.bindTools([subQuestionsTool]))
.pipe(new JsonOutputToolsParser())
.pipe((output) => {
  //LIMITE DANS LES PIPE OUTPUT ICI JE PEUX METTRE UN CONTROLE POUR ETRE SUR QUE C'EST QUE DES QUESTIONS
  //console.timeEnd("call output plannerChain");
  console.log('[plannerChain] Liste des requêtes:', JSON.stringify(output));
  return output[0].args; // Retourne les requêtes générées
});


/* FAIRE STRUCTURED OUTPUT */
/*
const plannerAgent = createReactAgent({
    llm,
    tools: [subQuestionsTool], // avoir ou sens
    messageModifier: new SystemMessage(PlannerAgentPrompt)
})

export const plannerNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    let expertMessages;
    const criticalAgentMessage = state.messages.find(
        (msg) => msg.name === "CriticalAgent"
    );
  
    // Premier passage pas encore eu de feedback de l'agent
    if (!criticalAgentMessage) //
    {
        expertMessages = "";
    } else {
        expertMessages = criticalAgentMessage.content;
    }

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(PlannerAgentPrompt)
      .format({
        summary: state.summary
    });

    const input: any = [
      systemMessage,
      ...expertMessages,
    ];

    try {
      console.timeEnd("[PlannerAgent] : Data ready, send to LLM.");
      const result = await plannerAgent.invoke({messages: input}, config);
      const lastMessage = result.messages[result.messages.length - 1];
      //state.subQuestions = [lastMessage.content, "WHAT"]
      console.log('PlannerAgent result:', lastMessage.content)
      console.timeEnd("[PlannerAgent] : invoke");
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "PlannerAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking planner agent:", error);
      return { messages: [] }
    }
};*/