"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { CriticalAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedArticlesTool } from "@/lib/ai/tools/getMatchedArticles";
import { getArticleByNumberTool } from '@/lib/ai/tools/getArticleByNumber'
import { GraphAnnotation } from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

    // ValidationAgent
export const criticalNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
    ) => {
    console.timeEnd("call critical Node");

    // Vérifier que toutes les réponses des agents sont présentes avant de lancer la validation
    const validationMessage = state.messages.find(
        (msg) => msg.name === "ValidationAgent"
    );
    const doctrineThinkingAgentMessage = state.messages.find(
        (msg) => msg.name === "DoctrinesThinkingAgent"
    );

    // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
    if (!validationMessage || !doctrineThinkingAgentMessage) // AJOUTER MANQAUNT
    {
        console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
        return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    const expertMessages = [validationMessage, doctrineThinkingAgentMessage] //, doctrineThinkingAgentMessage]; //, articlesThinkingAgentMessage
    console.log("[Critical Node] Message des experts:\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
        .fromTemplate(CriticalAgentPrompt)
        .format({
            summary: state.summary
        });

    const summary = state.summary;

    const input: any = [
        systemMessage,
        ...expertMessages,
    ];

    try {
        const result = await llm.invoke(input, config);
        console.log("Critical Agent response :", result.content)
        console.timeEnd("call criticalagent invoke");
        return {
        messages: [
            new HumanMessage({ content: result.content, name: "CriticalAgent" }),
        ],
        };
    } catch (error) {
        console.error("error when invoking validation agent:", error);
        return { messages: [] }
    }
};