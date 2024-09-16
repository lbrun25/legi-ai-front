"use server"
import {ChatOpenAI} from "@langchain/openai";
import {Annotation, END, START, StateGraph} from "@langchain/langgraph";
import {
  ArticlesAgentPrompt,
  DecisionsAgentPrompt,
  DoctrinesAgentPrompt, FormattingPrompt, ReflectionAgentPrompt,
  SupervisorPrompt, ValidationAgentPrompt
} from "@/lib/ai/langgraph/prompt";
import {AIMessage, BaseMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {getMatchedDecisions} from "@/lib/ai/tools/getMatchedDecisions";
import {getMatchedArticles} from "@/lib/ai/tools/getMatchedArticles";
import {getMatchedDoctrines} from "@/lib/ai/tools/getMatchedDoctrines";
import {getArticleByNumber} from "@/lib/ai/tools/getArticleByNumber";
import {z} from "zod";
import {ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate} from "@langchain/core/prompts";
import {JsonOutputToolsParser} from "langchain/output_parsers";
import {RunnableConfig} from "@langchain/core/runnables";
import {createReactAgent, ToolNode} from "@langchain/langgraph/prebuilt";

let cachedApp: any = null;

const GraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  // The agent node that last performed work
  nexts: Annotation<string[]>({
    reducer: (state, update) => update ?? state ?? END,
    default: () => [END],
  }),
  subQuestions: Annotation<string[]>({
    reducer: (state, update) => update ?? state,
    default: () => [],
  }),
})

const createGraph = async () => {
  const members = ["ArticlesAgent", "DecisionsAgent", "DoctrinesAgent"] as const;

  const options = ["FINISH", ...members];

  const routingTool = {
    name: "route",
    description: "Select the roles you need to answer to the response.",
    schema: z.object({
      nexts: z.array(z.enum(["FINISH", ...members])),
    }),
  }

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SupervisorPrompt],
    new MessagesPlaceholder("messages"),
    [
      "system",
      "Given the conversation above, who should act next?" +
      " Or should we FINISH? Select one of: {options}",
    ],
  ]);
  const formattedPrompt = await prompt.partial({
    options: options.join(", "),
    members: members.join(", "),
  });

  const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });

  console.time("call reflectionAgent");
  console.time("call doctrinesAgent")
  console.time("call doctrinesAgent invoke")
  console.time("call decisionsAgent")
  console.time("call decisionsAgent invoke")
  console.time("call articlesAgent")
  console.time("call articlesAgent invoke")
  console.time("call formattingAgent")
  console.time("call supervisor")
  console.time("call validationAgent")
  console.time("call validationAgent invoke")
  console.time("call reflection");

  const reflectionPrompt = ChatPromptTemplate.fromMessages([
    ["system", ReflectionAgentPrompt],
    new MessagesPlaceholder("messages"),
  ])
  const subQuestionsTool = {
    name: "subQuestions",
    description: "Transmets les questions au superadvisor",
    schema: z.object({
      subQuestions: z.array(z.string()),
    }),
  }

  const reflectionChain = reflectionPrompt
    .pipe(llm.bindTools([subQuestionsTool]))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) =>  { console.timeEnd("call reflection"); console.log('subQuestions:', JSON.stringify(x));  return (x[0].args) });


  // Supervisor
  const supervisorChain = formattedPrompt
    .pipe(llm.bindTools(
      [routingTool],
      {
        tool_choice: "route",
      },
    ))
    .pipe(new JsonOutputToolsParser())
    // select the first one
    .pipe((x) =>  {  console.timeEnd("call supervisor"); console.log('x:', JSON.stringify(x));  return (x[0].args) });

  const decisionsAgent = createReactAgent({
    llm,
    tools: [getMatchedDecisions],
    messageModifier: new SystemMessage(DecisionsAgentPrompt)
  })
  // const decisionsModel = llm.bindTools([getMatchedDecisions]);
  const decisionsNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call decisionsAgent");
    // console.log('decisionsNode state:', state)
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DecisionsAgentPrompt)
      .format({
        subQuestions: state.subQuestions.join("#"),
      });
    const input = [
      systemMessage,
    ]
    try {
      const result = await decisionsAgent.invoke({messages: input}, config);
      console.timeEnd("call decisionsAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "DecisionsAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisions agent:", error);
      return { messages: [] }
    }
  };

  // Formatting node to handle the final formatted response
  const formattingNode = async (state: typeof GraphAnnotation.State, config?: RunnableConfig) => {
    console.timeEnd("call formattingAgent");
    const lastMessage = state.messages[state.messages.length - 1];

    try {
      const input = [
        new SystemMessage({ content: FormattingPrompt }),
        lastMessage
      ];
      console.log("formatting input:", input)
      const result = await llm.withConfig({tags: ["formatting_agent"]}).invoke(input, config);
      console.timeEnd("formatting invoke")
      return {
        messages: [new HumanMessage({ content: result.content, name: "FormattingExpert" })],
      };
    } catch (error) {
      console.error("error when invoking formatting agent", error);
    }

    return {
      messages: [new HumanMessage({ content: "Impossible de construire la réponse veuillez reessayer", name: "FormattingExpert" })],
    };
  };

  const validationNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call validationAgent");
    const expertMessages = state.messages
      .filter((message) =>
        message.name !== undefined && ['DecisionsAgent'].includes(message.name)
      )
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ValidationAgentPrompt)
      .format({
        subQuestions: state.subQuestions.join("#"),
        userQuestion: state.messages[0].content,
      });

    const input = [
      systemMessage,
      ...expertMessages,
    ]
    const result = await llm.invoke(input, config);
    console.timeEnd("call validationAgent invoke");
    return {
      messages: [
        new HumanMessage({ content: result.content, name: "ValidationAgent" }),
      ],
    };
  };

  const shouldContinue = (state: typeof GraphAnnotation.State) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage.content === "string" && lastMessage.content.includes("FINISH")) {
      console.log("ValidationAgent FINISH -> Start formatting");
      return "FormattingAgent";
    }
    console.log("message incomplete: retry logic with supervisor")
    return "supervisor";
  }

  // Call directly tools in the expert agent https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/#define-tools by using subquestions
  // Problematic: getMatchedArticleByNumber ? Define a state like { article_numbers_extract_from_user_query: [{1492 Code Civil}, {...}] }
  // In order to avoid ReactAgent to speed up a bit ??
  //
  //

  const workflow = new StateGraph(GraphAnnotation)
    .addNode("ReflectionAgent", reflectionChain)
    .addNode("DecisionsAgent", decisionsNode)
    .addNode("FormattingAgent", formattingNode)
    .addNode("ValidationAgent", validationNode)
    .addNode("supervisor", supervisorChain);

  workflow.addEdge(START, "ReflectionAgent");
  workflow.addEdge("ReflectionAgent", "supervisor");
  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof GraphAnnotation.State) => x.nexts,
  );
  workflow.addEdge("DecisionsAgent", "ValidationAgent")
  workflow.addConditionalEdges("ValidationAgent", shouldContinue);
  workflow.addEdge("FormattingAgent", END);

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}
