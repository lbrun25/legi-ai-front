"use server"
import {tool} from "@langchain/core/tools";
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

export const subQuestionsTool = tool(async (input:any) => {
    try {
      console.log("INPUT SUBQUESTIONS :", input)
      // Validation de l'entrée
      if (!input) {
        throw new Error("La requête de recherche des articles ne peut pas être vide");
      }
      // Vérifier si la réponse est valide
      return input;
    } catch (error: any) {
        console.error("Erreur lors de la recherche des articles:", error);
        throw new Error(`Erreur lors de la recherche des articles: ${error.message}`);
    }
},
{
    name: "subQuestions",
    description: "Liste des sous-questions issues de la demande de l'utilisateur",
    schema: z.object({
        subQuestions: z.array(z.string()),
    }),
});
