"use server"
import {ToolNode} from "@langchain/langgraph/prebuilt";
import {ChatOpenAI} from "@langchain/openai";
import {Annotation, END, MemorySaver, START, StateGraph} from "@langchain/langgraph";
import {LawyerPrompt} from "@/lib/ai/langgraph/prompt";
import {BaseMessage} from "@langchain/core/messages";
import {getMatchedDecisions} from "@/lib/ai/tools/getMatchedDecisions";
import {getMatchedArticles} from "@/lib/ai/tools/getMatchedArticles";
import {getMatchedDoctrines} from "@/lib/ai/tools/getMatchedDoctrines";
import {getArticleByNumber} from "@/lib/ai/tools/getArticleByNumber";
import {formatResponse} from "@/lib/ai/tools/formatResponse";

let cachedApp: any = null;

const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  })
})

const createGraph = () => {
  const tools = [getMatchedDecisions] //, getMatchedArticles, getMatchedDoctrines, getArticleByNumber, formatResponse]
  const toolNode = new ToolNode(tools)

  const model = new ChatOpenAI({
    temperature: 0, model: "gpt-4o-mini", configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof GraphAnnotation.State): "tools" | typeof END {
    const messages = state.messages;

    const lastMessage = messages[messages.length - 1];

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.additional_kwargs.tool_calls) {
      console.log('shouldContinue: yes because tools have been called')
      return "tools";
    }
    // Otherwise, we stop (reply to the user)
    console.log('should not continue')
    return END;
  }

  // Define the function that calls the model
  async function callModel(state: typeof GraphAnnotation.State) {
    const modelResponse = model.invoke([{role: "system", content: LawyerPrompt},
      ...state.messages,
    ]);
    // We return a list, because this will get added to the existing list
    return {messages: modelResponse};
  }

  const workflow = new StateGraph(GraphAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = createGraph();
  return cachedApp;
}
