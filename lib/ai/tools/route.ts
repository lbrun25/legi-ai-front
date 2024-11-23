import {tool} from "@langchain/core/tools";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

export const route = tool(async (input:any) => {
    try {
      console.log("INPUT ROUTETOOL :", input)
      // Validation de l'entrée
      if (!input) {
        throw new Error("La requête du choix des agents ne peut pas être vide");
      }
      // Vérifier si la réponse est valide
      return "La liste des agents a été transmises vous vous arretez la.";
    } catch (error: any) {
        console.error("Erreur lors du choix des agents:", error);
        throw new Error(`Erreur lors du choix des agents: ${error.message}`);
    }
},
{
    name: "route",
    description: "Sélectionnez les membres qui semblent les plus qualifiés pour répondre au sommaire transmis.",
    schema: z.object({
        nexts: z.array(z.enum(["ArticlesAgent", "DecisionsAgent", "DoctrinesAgent", "WebSearchAgent"])),
    }),
});
