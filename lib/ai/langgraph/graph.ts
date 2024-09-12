"use server"
import {createReactAgent, ToolNode} from "@langchain/langgraph/prebuilt";
import {ChatOpenAI} from "@langchain/openai";
import {Annotation, END, MemorySaver, Messages, START, StateGraph} from "@langchain/langgraph";
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
import {formatResponse} from "@/lib/ai/tools/formatResponse";
import {z} from "zod";
import {ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate} from "@langchain/core/prompts";
import {JsonOutputToolsParser} from "langchain/output_parsers";
import {RunnableConfig} from "@langchain/core/runnables";

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
  userQuestion: Annotation<string>({
    reducer: (state, update) => update ?? state,
    default: () => "",
  }),
  subQuestions: Annotation<string[]>({
    reducer: (state, update) => update ?? state,
    default: () => [],
  }),
})

const createGraph = async () => {
  const members = ["ArticlesAgent", "DecisionsAgent", "DoctrineAgent"] as const;

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
  console.time("call decisionsAgent")
  console.time("call articlesAgent")
  console.time("call formattingAgent")
  console.time("call supervisor")
  console.time("call validationAgent")

  const reflectionPrompt = ChatPromptTemplate.fromMessages([
    ["system", ReflectionAgentPrompt],
    new MessagesPlaceholder("messages"),
    [
      "system",
      "Given the query above, what are the sub questions?"
    ],
  ])
  const subQuestionsTool = {
    name: "subQuestions",
    description: "Créer les sous-questions nécessaires pour répondre à la question.",
    schema: z.object({
      subQuestions: z.array(z.string()),
    }),
  }

  const reflectionChain = reflectionPrompt
    .pipe(llm.bindTools([subQuestionsTool]))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) =>  { console.log('subQuestions:', JSON.stringify(x));  return (x[0].args) });


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
    .pipe((x) =>  { console.log('x:', JSON.stringify(x));  return (x[0].args) });

  // ArticlesAgent
  const articlesAgent = createReactAgent({
    llm,
    tools: [getMatchedArticles, getArticleByNumber],
    messageModifier: new SystemMessage(ArticlesAgentPrompt)
  })
  const articlesNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call articlesAgent");
    // console.log('articlesNode state:', state)
    const result = await articlesAgent.invoke(state, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return {
      messages: [
        new HumanMessage({ content: lastMessage.content, name: "ArticlesAgent" }),
      ],
    };
  };

  const decisionsAgent = createReactAgent({
    llm,
    tools: [getMatchedDecisions],
    messageModifier: new SystemMessage(DecisionsAgentPrompt)
  })
  const decisionsNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call decisionsAgent");
    // console.log('decisionsNode state:', state)
    const result = await decisionsAgent.invoke(state, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return {
      messages: [
        new HumanMessage({ content: lastMessage.content, name: "DecisionsAgent" }),
      ],
    };
  };

  const doctrinesAgent = createReactAgent({
    llm,
    tools: [getMatchedDoctrines],
    messageModifier: new SystemMessage(DoctrinesAgentPrompt)
  })
  const doctrinesNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call doctrinesAgent");
    const result = await doctrinesAgent.invoke(state, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return {
      messages: [
        new HumanMessage({ content: lastMessage.content, name: "DoctrinesAgent" }),
      ],
    };
  };

  // Formatting node to handle the final formatted response
  const formattingNode = async (state: typeof GraphAnnotation.State, config?: RunnableConfig) => {
    console.timeEnd("call formattingAgent");
    // console.log('formattingNode state:', state)
    console.time("formatting invoke")
    const filteredMessages = state.messages
      .filter((message) =>
        message.name !== undefined && ['ArticlesAgent', 'DecisionsAgent', 'DoctrinesAgent'].includes(message.name)
      )

    try {
      filteredMessages.unshift(new SystemMessage({ content: FormattingPrompt }));
      const result = await llm.withConfig({tags: ["formatting_agent"]}).invoke(filteredMessages, config);
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
        message.name !== undefined && ['ArticlesAgent', 'DecisionsAgent', 'DoctrinesAgent'].includes(message.name)
      )
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ValidationAgentPrompt)
      .format({
        subQuestions: state.subQuestions.join("#"),
        userQuestion: state.userQuestion,
      });

    const input = [
      systemMessage,
      ...expertMessages,
    ]
    console.log("validationNode input:", input)

    const result = await llm.invoke(input, config);
    return {
      messages: [
        new HumanMessage({ content: result.content, name: "ValidationAgent" }),
      ],
    };
  };

  const shouldContinue = (state: typeof GraphAnnotation.State) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    console.log("lastMessage shouldContinue:", lastMessage)
    if (lastMessage.content.includes("FINISH")) {
      console.log("ValidationAgent FINISH -> Start formatting")
      return "FormattingAgent";
    }
    console.log("message incomplete: retry logic with supervisor")
    return "supervisor";
  }

  const workflow = new StateGraph(GraphAnnotation)
    .addNode("ReflectionAgent", reflectionChain)
    .addNode("ArticlesAgent", articlesNode)
    .addNode("DecisionsAgent", decisionsNode)
    .addNode("DoctrineAgent", doctrinesNode)
    .addNode("FormattingAgent", formattingNode)
    .addNode("ValidationAgent", validationNode)
    .addNode("supervisor", supervisorChain);

  workflow.addEdge(START, "ReflectionAgent");
  workflow.addEdge("ReflectionAgent", "supervisor");
  members.forEach((member) => {
    workflow.addEdge("supervisor", member);
  });
  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof GraphAnnotation.State) => x.nexts,
  );
  members.forEach((member) => {
    workflow.addEdge(member, "ValidationAgent")
  })
  workflow.addConditionalEdges("ValidationAgent", shouldContinue);
  workflow.addEdge("FormattingAgent", END);

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}
