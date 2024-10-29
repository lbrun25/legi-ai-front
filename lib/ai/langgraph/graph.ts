"use server"
import {createAssistantGraph} from "@/lib/ai/langgraph/assistantGraph";
import {createRedactionGraph} from "@/lib/ai/langgraph/redactionGraph";
import {Annotation, END, MemorySaver, START, StateGraph} from "@langchain/langgraph";
import {z} from "zod";
import {ChatPromptTemplate, MessagesPlaceholder} from "@langchain/core/prompts";
import {ChatOpenAI} from "@langchain/openai";
import {JsonOutputToolsParser} from "langchain/output_parsers";
import {SupervisorParentGraph, SupervisorPrompt} from "@/lib/ai/langgraph/prompt";
import {HumanMessage} from "@langchain/core/messages";

let cachedApp: any = null;

// Define the Main Graph Annotations
const MainGraphAnnotation = Annotation.Root({
  messages: Annotation<HumanMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (state, update) => state + "\n" + (update ?? ""),
    default: () => "",
  }),
  next: Annotation<string>({
    reducer: (state, update) => update ?? state ?? END,
    default: () => END,
  }),
  userInputs: Annotation<Record<string, string>>({
    reducer: (state, update) => state ?? update ?? {},
    default: () => ({})
  })
});

const llm = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  configuration: {
    apiKey: process.env.OPENAI_API_KEY!,
  }
});

const MEMBERS = ["AssistantGraph", "RedactionGraph"] as const;
const OPTIONS = ["FINISH", ...MEMBERS];

async function summaryChain(state: typeof MainGraphAnnotation.State) {
  const summaryTool = {
    name: "summary",
    description: "Établit un sommaire de la demande de l'utilisateur",
    schema: z.object({
      summary: z.string(),
    }),
  }
  const summaryPrompt = ChatPromptTemplate.fromMessages([
    ["system", "Please provide a summary of the following input."],
    new MessagesPlaceholder("messages"),
  ]);
  return summaryPrompt
    .pipe(llm.bindTools([summaryTool]))
    .pipe(new JsonOutputToolsParser())
    .pipe((output) => {
      const summary = output[0].args.summary;
      console.log('summary:', summary)
      return {summary};
    });
}

async function supervisorChain(state: typeof MainGraphAnnotation.State) {
  const routingTool = {
    name: "route",
    description: "Sélectionnez le graph qui semble être le plus qualifiés entre de la rédaction ou de la recherche juridique pour répondre au sommaire transmis.",
    schema: z.object({
      next: z.string(z.enum(["FINISH", ...MEMBERS])),
    }),
  }
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SupervisorParentGraph],
    new MessagesPlaceholder("messages"),
    [
      "system",
      "À partir de la conversation ci-dessus, identifiez qui devrait intervenir ensuite: {options}. Sélectionnez \"FINISH\" si aucune autre action n'est nécessaire.",
    ],
  ]);
  const formattedPrompt = await prompt.partial({
    summary: state.summary,
    options: OPTIONS.join(", "),
    members: MEMBERS.join(", "),
  });
  return formattedPrompt
    .pipe(llm.bindTools(
      [routingTool],
      {
        tool_choice: "route",
      },
    ))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.timeEnd("call supervisor");
      const next = x[0].args.next;
      console.log('[graph] Supervisor next:', next);
      return {next};
    });
}

const createGraph = async () => {
  const assistantGraph = await createAssistantGraph();
  const redactionGraph = await createRedactionGraph();

  function shouldContinue(state: typeof MainGraphAnnotation.State): "Supervisor" | typeof END {
    const summary = state.summary?.trim();
    if (!summary) {
      console.log('[ShouldContinue] No messages, stopping the chain.');
      return END;
    }
    return "Supervisor";
  }

  const workflow = new StateGraph(MainGraphAnnotation)
    .addNode("Summary", summaryChain)
    .addNode("Supervisor", supervisorChain)
    .addNode("AssistantGraph", assistantGraph)
    .addNode("RedactionGraph", redactionGraph);

  workflow.addEdge(START, "Summary");
  workflow.addConditionalEdges("Summary", shouldContinue);
  MEMBERS.forEach((member) => {
    workflow.addEdge(member, "Supervisor");
  });
  workflow.addConditionalEdges(
    "Supervisor",
    (x: typeof MainGraphAnnotation.State) => {
      console.log('[graph] supervisor conditionalEdge:', x)
      console.log('[graph] userInputs:', x.userInputs)
      if (x.next !== "FINISH") {
        return x.next;
      }
      console.log('finish by END')
      return END;
    }
  );
  MEMBERS.forEach((member) => {
    workflow.addEdge(member, END);
  });

  const memory = new MemorySaver();

  return workflow.compile({
    checkpointer: memory,
  });
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}
