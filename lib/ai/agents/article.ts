"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ArticleAgentPrompt } from "@/lib/ai/langgraph/prompt";
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

const articleAgent = createReactAgent({
    llm,
    tools: [getMatchedArticlesTool, getArticleByNumberTool],
    messageModifier: new SystemMessage(ArticleAgentPrompt)
})
  
export const articleAgentNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    //console.timeEnd("call articleAgent");
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ArticleAgentPrompt)
      .format({
        summary: state.summary
      });
    const input = [
      systemMessage,
    ]
    try {
      const result = await articleAgent.invoke({messages: input}, config);
      console.timeEnd("call ArticleAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('ArticleAgent result:', lastMessage.content)
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "ArticleAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
}; 