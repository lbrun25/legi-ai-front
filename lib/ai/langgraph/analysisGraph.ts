import {Annotation, END, START, StateGraph} from "@langchain/langgraph";
import {BaseMessage} from "@langchain/core/messages";
import {getMatchedUserDocumentsTool} from "@/lib/ai/tools/getMatchedUserDocuments";
import {ToolNode} from "@langchain/langgraph/prebuilt";
import {ChatOpenAI} from "@langchain/openai";
import {AnalysisPrompt} from "@/lib/ai/langgraph/prompt";

let cachedApp: any = null;

const AnalysisGraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  })
})

const createAnalysisGraph = () => {
  const tools = [getMatchedUserDocumentsTool];
  const toolNode = new ToolNode(tools);

  // TODO: use {tool_choice: "required"} to force call the tool
  const model = new ChatOpenAI({
    temperature: 0, model: "gpt-4o-mini", configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
  }).bindTools(tools, {tool_choice: "auto"});

  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof AnalysisGraphAnnotation.State): "tools" | typeof END {
    const messages = state.messages;

    const lastMessage = messages[messages.length - 1];

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.additional_kwargs.tool_calls) {
      console.log('shouldContinue: yes because tools have been called')
      return "tools";
    }
    console.log('shouldContinue: no')
    return END;
  }

  async function callModel(state: typeof AnalysisGraphAnnotation.State) {
    const modelResponse = model.invoke([{role: "system", content: AnalysisPrompt},
      ...state.messages,
    ]);
    return {messages: modelResponse};
  }

  const workflow = new StateGraph(AnalysisGraphAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow.compile();
}

export const getCompiledAnalysisGraph = async () => {
  if (!cachedApp)
    cachedApp = createAnalysisGraph();
  return cachedApp;
}
