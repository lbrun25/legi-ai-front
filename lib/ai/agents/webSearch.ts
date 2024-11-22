"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { WebSearchAgentPrompt } from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
//import { webSearch, getSearchResults, getLastSearchKey} from '@/lib/ai/tools/webSearchTool' // Pour passer contenu site à cette page
import { webSearch } from '@/lib/ai/tools/webSearchTool'
import { GraphAnnotation } from '@/lib/ai/langgraph/graph'


const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
});

const webSearchAgent = createReactAgent({
    llm,
    tools: [webSearch],
    messageModifier: new SystemMessage(WebSearchAgentPrompt)
})

export const webSearchNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(WebSearchAgentPrompt)
      .format({
        summary: state.summary
      });
    const input = [
      systemMessage,
    ]
    try {
      const result = await webSearchAgent.invoke({messages: input}, config);
      //console.timeEnd("call webSearchAgent invoke")
      /* TEST 
      const searchKey = getLastSearchKey();
      if (!searchKey) {
          return Response.json({ error: "Aucune recherche trouvée" });
      }
      const results = await getSearchResults(searchKey);
      if (!results) {
          return { error: "Aucun résultat trouvé" };
      }
      console.log("Resultat searchKey", results)*/
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('[WebSearchAgent] Response :', lastMessage.content)
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "WebSearchAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
}; 

