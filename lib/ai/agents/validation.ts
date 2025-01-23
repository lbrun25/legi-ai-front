"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ValidationAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDoctrinesTool } from "@/lib/ai/tools/getMatchedDoctrines";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

// ValidationAgent
export const validationNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call validationAgent");

    // Vérifier que toutes les réponses des agents sont présentes avant de lancer la validation
    const articlesThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "ArticlesThinkingAgent"
    );
    const decisionsThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "DecisionsThinkingAgent"
    );
    const doctrineInterpretHydeAgentMessage = state.messages.find(
      (msg) => msg.name === "DoctrinesInterpretHydeAgent"
    );
    // const WebSearchAgentAgentMessage = state.messages.find(
    //   (msg) => msg.name === "WebSearchAgent"
    // );

    // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
    if (!doctrineInterpretHydeAgentMessage || !decisionsThinkingAgentMessage)
    {
      console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    const expertMessages = [doctrineInterpretHydeAgentMessage, decisionsThinkingAgentMessage] //, doctrineThinkingAgentMessage]; //, articlesThinkingAgentMessage
    //console.log("[ValidationNODE] Message des experts:\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ValidationAgentPrompt)
      .format({
        summary : state.summary
      });

    const input: any = [
      systemMessage,
      ...expertMessages,
    ];

    try {
      console.timeEnd("[ValidationAgent] : Data ready, send to LLM.");
      const result = await llm.invoke(input);
      console.log("[Validation Agent] response :", result.content)
      console.timeEnd("[ValidationAgent] : invoke");
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "ValidationAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking validation agent:", error);
      return { messages: [] }
    }
};

/*
"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ValidationAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDoctrinesTool } from "@/lib/ai/tools/getMatchedDoctrines";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'
import { getArticleByNumberTool } from '@/lib/ai/tools/getArticleByNumber'


const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

const validationAgent = createReactAgent({
  llm,
  tools: [getArticleByNumberTool],
  messageModifier: new SystemMessage(ValidationAgentPrompt)
})
// ValidationAgent
export const validationNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call validationAgent");

    // Vérifier que toutes les réponses des agents sont présentes avant de lancer la validation
    const articlesThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "ArticlesThinkingAgent"
    );
    const decisionsThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "DecisionsThinkingAgent"
    );
    const doctrineInterpretHydeAgentMessage = state.messages.find(
      (msg) => msg.name === "DoctrinesInterpretHydeAgent"
    );
    const WebSearchAgentAgentMessage = state.messages.find(
      (msg) => msg.name === "WebSearchAgent"
    );

    // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
    if (!doctrineInterpretHydeAgentMessage || !decisionsThinkingAgentMessage|| !WebSearchAgentAgentMessage)
    {
      console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    const expertMessages = [doctrineInterpretHydeAgentMessage, decisionsThinkingAgentMessage, WebSearchAgentAgentMessage] //, doctrineThinkingAgentMessage]; //, articlesThinkingAgentMessage
    //console.log("[ValidationNODE] Message des experts:\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ValidationAgentPrompt)
      .format({
        summary : state.summary
      });

    const input: any = [
      systemMessage,
      ...expertMessages,
    ];

    try {
      console.timeEnd("[ValidationAgent] : Data ready, send to LLM.");
      const result = await validationAgent.invoke({messages: input}, config); // Est-ce qu'il y a pas deux fois le prompt avec l'input et à la création
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("[Validation Agent] response :", lastMessage.content)
      console.timeEnd("[ValidationAgent] : invoke");
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "ValidationAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking validation agent:", error);
      return { messages: [] }
    }
};
*/
