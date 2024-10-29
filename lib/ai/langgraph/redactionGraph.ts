import {Annotation, END, START, StateGraph} from "@langchain/langgraph";
import {z} from "zod";
import {ChatOpenAI} from "@langchain/openai";
import {ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate} from "@langchain/core/prompts";
import {JsonOutputToolsParser} from "langchain/output_parsers";
import {HumanMessage, SystemMessage} from "@langchain/core/messages";
import {pubSubClient} from "@/lib/google/pubSubClient";
import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {RunnableConfig} from "@langchain/core/runnables";
import {
  ContractTypeAgentPrompt,
  ContractTypeAgentToolDescription, GetPlaceholdersToolDescription, PlanAgentPrompt,
  RedactorAgentPrompt, UserInputPrompt
} from "@/lib/ai/langgraph/prompt";

// Define the state schema using annotations
const RedactionAnnotation = Annotation.Root({
  messages: Annotation<HumanMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  redactionSteps: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  contractModel: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  reviewStatus: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
  contractType: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  placeholders: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  awaitingUserInput: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
  userInputs: Annotation<Record<string, string>>({
    reducer: (state, update) => state ?? update ?? {},
    default: () => ({})
  })
});

const ALL_CONTRACTS = [
  "Accord de confidentialité",
  "Accord de Non-concurrence"
]

const ALL_CLAUSES = [
  "Comparution",
  "Préambule",
  "Définitions ",
  "Objet ",
  "Obligation de confidentialité ",
  "Durée Accord de Confidentialité ",
  "Pénalité en cas de non respect ",
  "Intégralité de l'Accord ",
  "Notifications  ",
  "Droit Applicable ",
  "Date et Signature ",
  "Obligation de non-concurrence ",
  "Droit de Propriété ",
  "Cession droit d'auteur et PI"
]

interface Contract {
  id: bigint,
  created_at: Date,
  components: string,
  type: string,
  title: string,
  instructions: string
}

async function getContractByType(type: string): Promise<Contract | null> {
  const { data, error } = await supabaseClient
    .from('contracts')
    .select('*')
    .eq('type', type)
    .single();
  if (error) {
    console.error('Error fetching contract:', error);
    return null;
  }
  return data;
}

async function getClausesByTypes(types: string[]): Promise<Clause[]> {
  const { data, error } = await supabaseClient
    .from('clauses')
    .select('*')
    .in('type', types);
  if (error) {
    console.error('Error fetching clauses:', error);
    return [];
  }
  return data || [];
}

interface Clause {
  id: bigint;
  created_at: Date;
  content: string;
  instructions: string;
  type: string;
}

const llm = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  configuration: {
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

async function contractTypeChain(state: typeof RedactionAnnotation.State) {
  // TODO: pass the summary state from MainGraph to the RedactionGraph to replace messages
  const planPrompt = ChatPromptTemplate.fromMessages([
    ["system", ContractTypeAgentPrompt],
    new MessagesPlaceholder("messages"),
  ]);
  const formattedPlanPrompt = await planPrompt.partial({
    contracts: ALL_CONTRACTS.join(",")
  });
  const getContractTypeTool = {
    name: "getContractTypeTool",
    description: ContractTypeAgentToolDescription,
    schema: z.object({
      contractType: z.string(z.enum(["UNKNOWN", ...ALL_CONTRACTS])),
    }),
  }
  return formattedPlanPrompt
    .pipe(llm.bindTools(
      [getContractTypeTool],
      {
        tool_choice: "getContractTypeTool",
      },
    ))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.log('[contractTypeChain]:', JSON.stringify(x));
      return (x[0].args);
    });
}

// ExecuteAgent Chain: Constructs the contract model
async function executeChain(state: typeof RedactionAnnotation.State, config?: RunnableConfig) {
  return state;
}

// RedactorAgent Chain: Placeholder for returning the model
async function redactorChain(state: typeof RedactionAnnotation.State, config?: RunnableConfig) {
  const userInputMessage = state.messages[state.messages.length - 1];
  const input = [
    new SystemMessage({content: RedactorAgentPrompt}),
    userInputMessage,
  ];
  const result = await llm.invoke(input, config);
  return {
    messages: [
      new HumanMessage({
        content: result.content,
        name: "RedactorAgent",
      }),
    ],
  };
}

// RevisorAgent Chain: Reviews the contract model
async function revisorChain(state: typeof RedactionAnnotation.State) {
  // Simulated review process
  // const isContractCorrect = Math.random() > 0.5; // Randomly determine correctness for this example
  //
  // if (isContractCorrect) {
  //   state.reviewStatus = true;
  //   console.log("Contract approved.");
  // } else {
  //   state.reviewStatus = false;
  //   console.log("Contract needs modification. Requesting redaction...");
  // }

  return state;
}

function generateContractXML(clauses: Clause[]): string {
  const xmlClauses = clauses.map((clause) => `
    <clause>
      <type>${clause.type}</type>
      <content>${clause.content}</content>
      <instructions>${clause.instructions}</instructions>
    </clause>
  `).join('');

  return `<contract>
    <clauses>${xmlClauses}
    </clauses>
  </contract>`;
}


async function planChain(state: typeof RedactionAnnotation.State, config?: RunnableConfig) {
  const contractType = state.contractType;
  console.log('[planChain] received contract type:', contractType);

  if (contractType === "UNKNOWN") {
    // TODO: handling the case when the contract type is not recognized
    return state;
  }
  const contract = await getContractByType(contractType);
  if (!contract) {
    // TODO: handling the case when the contract is null
    return state;
  }
  const contractClauseTypes = contract.components.split(', ').map(clause => clause.trim());
  const clauses = await getClausesByTypes(contractClauseTypes);
  if (clauses.length === 0) {
    // TODO: handling there are no clauses
    return state;
  }
  const contractXML = generateContractXML(clauses);
  state.contractModel = contractXML;
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", PlanAgentPrompt],
    new MessagesPlaceholder("messages"),
    new HumanMessage({content: `Voici le contract XML: ${contractXML}`}),
  ]);
  const tool = {
    name: "getPlaceholdersTool",
    description: GetPlaceholdersToolDescription,
    schema: z.object({
      placeholders: z.array(z.string()),
    }),
  }
  return prompt
    .pipe(llm.bindTools(
      [tool],
      {
        tool_choice: "getPlaceholdersTool",
      },
    ))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.log('[planChain]:', JSON.stringify(x));
      // TODO: what happens if there are no placeholders, check if the route messages continue and not wait for a response of user inputs
      const placeholders = x[0].args.placeholders;
      if (placeholders.length > 0) {
        console.log("Requesting user input for placeholders...");
        state.placeholders = placeholders;
        state.awaitingUserInput = true;
        return state;
      }
      return placeholders;
    });
}

async function userInputHandlerChain(state: typeof RedactionAnnotation.State, config?: RunnableConfig) {
  const subscriber = pubSubClient.subscription("agent-input-responses-sub");
  const [subscription] = await subscriber.get({ autoCreate: true });
  console.log('userInputHandlerChain config:', config)
  const userInputs = await new Promise<Record<string, string>>((resolve, reject) => {
    const messageHandler = (message: any) => {
      const parsedData: { threadId: string, userInputs: Record<string, string> } = JSON.parse(message.data.toString());
      if (config?.metadata?.thread_id !== parsedData.threadId) {
        console.warn(`[userInputHandlerChain] received userInputs for thread_id ${parsedData.threadId} does not match with the configurable thread_id ${config?.metadata?.thread_id}`);
        // TODO: handle error
        message.ack();
        return;
      }
      if (parsedData.userInputs) {
        resolve(parsedData.userInputs);
        message.ack();
        subscription.removeListener('message', messageHandler);
      }
    };
    subscription.on('message', messageHandler);
  });
  console.log('[userInputHandlerChain] received user inputs:', userInputs);
  state.userInputs = userInputs;
  state.awaitingUserInput = false;

  const input = [
    new SystemMessage({content: UserInputPrompt}),
    new HumanMessage({
      content: `Voici le contrat XML à compléter :\n\n${state.contractModel}\n\nVoici les informations que l'utilisateur a fournies : ${JSON.stringify(userInputs, null, 2)}`
    })
  ];
  const result = await llm.invoke(input, config);
  return {
    messages: [
      new HumanMessage({ content: result.content, name: "UserInputAgent" }),
    ],
  };
}

function shouldContinue(state: typeof RedactionAnnotation.State): "Supervisor" | typeof END {
  console.log('[ShouldContinue] messages:', state.messages);
  return END;
}

// Define the Redaction Subgraph Workflow
export const createRedactionGraph = async () => {
  const workflow = new StateGraph(RedactionAnnotation)
    .addNode("ContractTypeAgent", contractTypeChain)
    .addNode("PlanAgent", planChain)
    .addNode("UserInputAgent", userInputHandlerChain)
    .addNode("ExecuteAgent", executeChain)
    .addNode("RedactorAgent", redactorChain)
    .addNode("RevisorAgent", revisorChain);

  // Define connections
  workflow.addEdge(START, "ContractTypeAgent");
  workflow.addEdge("ContractTypeAgent", "PlanAgent");
  workflow.addEdge("PlanAgent", "UserInputAgent");
  workflow.addEdge("UserInputAgent", "ExecuteAgent");
  workflow.addEdge("ExecuteAgent", "RedactorAgent");

  // Conditional cycle between RevisorAgent and RedactorAgent
  // workflow.addConditionalEdges(
  //   "RevisorAgent",
  //   (state: typeof RedactionAnnotation.State) => state.reviewStatus ? "end" : "RedactorAgent",
  //   {
  //     RedactorAgent: "RedactorAgent",
  //     end: END,
  //   }
  // );
  workflow.addEdge("RedactorAgent", "RevisorAgent");
  workflow.addConditionalEdges("RevisorAgent", shouldContinue)

  // Compile the workflow
  return workflow.compile({
    interruptBefore: ["UserInputAgent"],
  });
};
