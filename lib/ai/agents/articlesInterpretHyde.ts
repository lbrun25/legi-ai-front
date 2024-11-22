"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { articlesInterpretHydePrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";
import { getMatchedArticles, articlesCleaned, getMatchedArticlesTool } from "@/lib/ai/tools/getMatchedArticles";
import { getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";
import { mergeResults } from '../../utils/mergeResults'
import { GraphAnnotation} from '@/lib/ai/langgraph/graph'

const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

/* RESULTAT PAS OUF LORS DES TESTS */
/* ATTENTION IL FAUT BIEN LE CHAIN AVANT ACTUELLEMENT CAR IL RECOIT LES QUERYS A EXECUTER */

export const articlesInterpretHydeNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("Call ArticlesInterpretHydeAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const hydeAgentMessage = state.messages.find(
      (msg) => msg.name === "HydeAgent"
    );
    if (!hydeAgentMessage)
    {
      console.log("[ArticlesInterpretHydeAgent] : Doctrine non reçue.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    console.log("queries :", state.queries)
    async function getArticlesExpertMessages() {
      const expertMessages: string[] = [];
      const querySave: string[] = []
      console.timeEnd("[ArticlesInterpretHydeAgent] : Start searching articles in DB.");

      // Convertir les appels à getArticleByNumber2 et getMatchedArticles en promises pour un traitement parallèle
      const promises = state.queries.map(async (query) => {
        let message;
        if (query.includes("getArticleByNumber")) {
          message = await getArticleByNumber2(query);
          if (!message) {
            await delay(100); // Attente avant de réessayer si nécessaire
            message = await getArticleByNumber2(query);
          }
          // Ajouter directement le message à expertMessages
          if (message) {
            expertMessages.push(message);
          }
          return null; // Retourne null pour ne pas inclure ce message dans results
        } else {
          // querySave.push(query)
          message = await getMatchedArticles(query);
          if (!message) {
            await delay(1000); // Attente avant de réessayer si nécessaire
            message = await getMatchedArticles(query);
          }
          return message;
        }
      });

      const results = (await Promise.all(promises)).filter((res) => res !== null);
      const mergedResults = await mergeResults(results) // merge les ids des memes codes sans les doublons
      //console.timeEnd("[ArticlesInterpretHydeAgent] : Done searching articles in DB.");

      for (const result of mergedResults) {
        const { codeName, listIDs } = result;
        let i = 0
        const cleanedResult = await articlesCleaned(codeName, listIDs, state.summary);
        // const cleanedResult = await articlesCleaned(codeName, listIDs, querySave[i]);
        if (cleanedResult) {
          expertMessages.push(cleanedResult);
        }
        i++;
      }
      return expertMessages;
    }


    const expertMessages = await getArticlesExpertMessages();

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(articlesInterpretHydePrompt) // PROMPT A UPDATE
      .format({
        summary: state.summary
      });

    const input: any = [
      systemMessage,
      ...expertMessages
    ];

    try {
      //console.timeEnd("[ArticlesInterpretHydeAgent] : Data Ready, send to LLM");
      const result = await llm.invoke(input, config);
      console.log("[ArticlesInterpretHydeAgent] input :", input)
      //console.timeEnd("[ArticlesInterpretHydeAgent] : invoke");
      const lastMessage = result.content
      console.log("ArticlesInterpretHydeAgent Content :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "ArticlesInterpretHydeAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking ArticlesInterpretHydeAgent agent:", error);
      return { messages: [] }
    }
  };
  