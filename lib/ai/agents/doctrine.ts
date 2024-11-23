"use server"
import {DoctrineAgentPrompt} from "@/lib/ai/langgraph/prompt";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {SystemMessagePromptTemplate} from "@langchain/core/prompts";
import {RunnableConfig} from "@langchain/core/runnables";
import {getMatchedDoctrinesTool} from "@/lib/ai/tools/getMatchedDoctrines";
import {GraphAnnotation} from '@/lib/ai/langgraph/graph'
import {ChatOpenAI} from "@langchain/openai";
import {createReactAgent} from "@langchain/langgraph/prebuilt";
import {BaseChatModel} from "@langchain/core/language_models/chat_models";

const llm = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  configuration: {
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

const doctrineAgent = createReactAgent({
    llm: llm as unknown as BaseChatModel,
    tools: [getMatchedDoctrinesTool],
    messageModifier: new SystemMessage(DoctrineAgentPrompt)
})
  // const decisionsModel = llm.bindTools([getMatchedDecisions]);

export const doctrineAgentNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    //console.timeEnd("call DoctrineAgent");
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DoctrineAgentPrompt)
      .format({
        summary: state.summary
      });
    const input = [
      systemMessage,
    ]
    try {
      const result = await doctrineAgent.invoke({messages: input}, config);
      console.timeEnd("call DoctrineAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('DoctrineAgent result:', lastMessage.content)
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "DoctrineAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
};
