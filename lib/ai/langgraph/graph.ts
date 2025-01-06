import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  DecisionsAgentPrompt,
  FormattingPrompt,
  ArticlesAgentPrompt,
  ArticlesAgentPrompt2,
  ArticlesThinkingAgent2,
  DoctrinesAgentPrompt,
  SupervisorPrompt,
} from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDecisions, listDecisions } from "@/lib/ai/tools/getMatchedDecisions";
import { getMatchedArticles, articlesCleaned, getMatchedArticlesTool } from "@/lib/ai/tools/getMatchedArticles";
import { getMatchedDoctrines, listDoctrines } from "@/lib/ai/tools/getMatchedDoctrines";
import { getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";
import { mergeResults } from '../../utils/mergeResults'
import { webSearch } from '@/lib/ai/tools/webSearchTool'
import {hydeNode} from '@/lib/ai/agents/hyde'
import { doctrinesInterpretHydeNode } from '@/lib/ai/agents/doctrineInterpretHyde'
import { webSearchNode } from '@/lib/ai/agents/webSearch'
import { decisionsInterpretHydeNode } from '@/lib/ai/agents/decisionsInterpretHyde'
import { decisionAgentNode } from '@/lib/ai/agents/decision'
import { articlesInterpretHydeNode } from '@/lib/ai/agents/articlesInterpretHyde'
import { decisionsThinkingNode } from '@/lib/ai/agents/decisionsThinking'
import { doctrineAgentNode } from '@/lib/ai/agents/doctrine'
import { articleAgentNode } from '@/lib/ai/agents/article'
import { criticalNode } from '@/lib/ai/agents/critical'
import { reflectionChain } from '@/lib/ai/agents/reflection'
import { articlesThinkingNode } from '@/lib/ai/agents/articlesThinking'
import { doctrinesIntermediaryNode } from '@/lib/ai/agents/doctrinesThinking'
import { validationNode } from '@/lib/ai/agents/validation'
import { plannerChain } from '@/lib/ai/agents/planner'
import { supervisorNode } from '@/lib/ai/agents/supervisor'

let cachedApp: any = null;

export const GraphAnnotation = Annotation.Root({
  messages: Annotation<HumanMessage[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  nexts: Annotation<string[]>({
    reducer: (state, update) => update ?? state ?? END,
    default: () => [END],
  }),
  requestDoctrines: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (state, update) => state + "\n" + (update ?? ""),
    default: () => "",
  }),
  queries: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  queries2: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  queriesDecisionsList: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  summaryToolCall: Annotation<boolean>({
    reducer: (update) => update, // Remplace simplement le booléen
    default: () => true, // Valeur par défaut à 'true'
  }),
  subQuestions: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  })
});

const createGraph = async () => {

  const members = ["ArticlesAgent", "DecisionsAgent","WebSearchAgent", "DoctrinesAgent" ] as const;
  const options = ["FINISH", ...members];

  const routingTool = {
    name: "route",
    description: "Sélectionnez les membres qui semblent les plus qualifiés pour répondre au sommaire transmis.",
    schema: z.object({
      nexts: z.array(z.enum([...members])),
    }),
  }

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SupervisorPrompt],
    new MessagesPlaceholder("messages"),
    [
      "system",
      "Given the conversation above, who should act next?"
    ],
  ]);

  const formattedPrompt = await prompt.partial({
    //options: options.join(", "),
    //members: members.join(", "),
  });

  const llm = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });

  const llm2 = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });
  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof GraphAnnotation.State): "Supervisor" | typeof END {
    const summary = state.summary;
    // Vérifie si le tableau de messages est vide
    if (summary === "") {
      console.log('[ShouldContinue] No messages, stopping the chain.');
      return END;
    }
    return "Supervisor";
  }

/* SUPERVISOR */

  const supervisorChain = prompt
    // @ts-ignore
    .pipe(llm.bindTools(
      [routingTool],
      {
        tool_choice: "route",
      },
    ))
    // @ts-ignore
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.log('Supervisor décision:', x[0].args);
      return (x[0].args);
    });

/* ARTICLES CHAIN */

  const articlesPrompt = ChatPromptTemplate.fromMessages([
    ["system", ArticlesAgentPrompt], // Votre prompt spécifique pour ArticlesAgent
    new MessagesPlaceholder("messages"),
  ]);

  // Définition de l'outil pour ArticlesAgent
  const queryListTool = {
    name: "queries_list",
    description: "Établit une liste de requêtes basée sur la demande de l'utilisateur",
    schema: z.object({
      queries: z.array(z.string()),
    }),
  };

  // Création de la chaîne de traitement pour ArticlesAgent
  const articlesChain = articlesPrompt
    // @ts-ignore
    .pipe(llm.bindTools([queryListTool]))
    // @ts-ignore
    .pipe(new JsonOutputToolsParser())
    .pipe((output) => {
      console.timeEnd("call output articlesChain");
      console.log('[articlesChain] Liste des requêtes:', JSON.stringify(output));
      return output[0].args; // Retourne les requêtes générées
    });

/* DOCTRINE CHAIN */

  const doctrinesPrompt = ChatPromptTemplate.fromMessages([
    ["system", DoctrinesAgentPrompt], // Votre prompt spécifique pour ArticlesAgent
    new MessagesPlaceholder("messages"),
  ]);

  // Définition de l'outil pour ArticlesAgent
  const doctrineRequestListTool = {
    name: "doctrineRequestListTool",
    description: "Établit une liste de requêtes basée sur la demande de l'utilisateur",
    schema: z.object({
      requestDoctrines: z.array(z.string()),
    }),
  };

  // Création de la chaîne de traitement pour ArticlesAgent
  const doctrinesChain = doctrinesPrompt
    // @ts-ignore
    .pipe(llm.bindTools([doctrineRequestListTool]))
    // @ts-ignore
    .pipe(new JsonOutputToolsParser())
    .pipe((output) => {
      console.timeEnd("call output doctrinesChain");
      //console.log('Liste des requêtes en matièere de doctrine :', JSON.stringify(output));
      return output[0].args; // Retourne les requêtes générées
    });

/* DECISIONS CHAIN*/

  const decisionsPrompt = ChatPromptTemplate.fromMessages([
    ["system", DecisionsAgentPrompt], // Votre prompt spécifique pour decisionsAgent
    new MessagesPlaceholder("messages"),
  ]);

  const queryDecisionsListTool = {
    name: "queryDecisionsListTool",
    description: "Établit une liste de requêtes basée sur la demande de l'utilisateur",
    schema: z.object({
      queriesDecisionsList: z.array(z.string()),
    }),
  };

  // Création de la chaîne de traitement pour ArticlesAgent
  const decisionsChain = decisionsPrompt
    // @ts-ignore
    .pipe(llm.bindTools([queryDecisionsListTool]))
    // @ts-ignore
    .pipe(new JsonOutputToolsParser())
    .pipe((output) => {
      console.log('[decisionsChain] Liste des requêtes:', JSON.stringify(output));
      return output[0].args; // Retourne les requêtes générées
    });

/* FORMATTING AGENT */

const formattingNode = async (
  state: typeof GraphAnnotation.State,
  config?: RunnableConfig,
) => {
  console.timeEnd("call formattingAgent");

  // Récupérer le summary
  const summary = state.summary;
  // Trouver le message du Validation Agent
 const validationMessage = state.messages.find(
    (msg) => msg.name === "ValidationAgent"
  );
  const criticalMessage = state.messages.find(
    (msg) => msg.name === "CriticalAgent"
  );

  // Si validationMessage est vide, ne rien faire
  if (!validationMessage) {
    console.log("Aucune réponse de criticalMessage, le formattingNode ne fait rien.");
    return { messages: [] };  // Renvoyer un état vide pour indiquer qu'aucune action n'a été prise
  }

  try {
    // Construire l'entrée pour le Formatting Agent avec summary et validation response
    const input = [
      new SystemMessage({ content: FormattingPrompt }),
      new HumanMessage({ content: validationMessage.content, name: "ValidationAgent" }), // validationMessage
    ];

    //console.log("formatting input:", input);

    // Appeler le modèle LLM avec l'entrée modifiée
    const result = await llm
      .withConfig({ tags: ["formatting_agent"] })
      .invoke(input);

    console.timeEnd("call formatting invoke");

    return {
      messages: [
        new HumanMessage({
          content: result.content,
          name: "FormattingExpert",
        }),
      ],
    };
  } catch (error) {
    console.error("error when invoking formatting agent", error);
  }

  return {
    messages: [
      new HumanMessage({
        content: "Impossible de construire la réponse, veuillez réessayer.",
        name: "FormattingExpert",
      }),
    ],
  };
};

  // Définition du workflow
  const workflow = new StateGraph(GraphAnnotation)
    .addNode("ReflectionAgent", reflectionChain)

    .addNode("Supervisor", supervisorChain)
    .addNode("SupervisorAgent", supervisorNode)

    .addNode("PlannerAgent", plannerChain)

    .addNode("DecisionsAgent", decisionsChain) // attention car meme nom presque pour celui qui fait les call tout seul
    .addNode("DecisionAgent", decisionAgentNode) // attention car meme nom presque pour celui qui fait pas les call tout seul

    .addNode("ArticlesAgent", articlesChain)
    .addNode("ArticleAgent", articleAgentNode)

    .addNode("DoctrinesAgent", doctrinesChain)
    .addNode("DoctrineAgent", doctrineAgentNode) // attention car meme nom presque pour celui qui fait pas les call tout seul

    .addNode("ArticlesThinkingAgent", articlesThinkingNode)
    .addNode("ArticlesInterpretHydeAgent", articlesInterpretHydeNode)

    .addNode("DoctrinesThinkingAgent", doctrinesIntermediaryNode)
    .addNode("DoctrinesInterpretHydeAgent", doctrinesInterpretHydeNode)

    .addNode("DecisionsThinkingAgent", decisionsThinkingNode)
    .addNode("DecisionsInterpretHydeAgent", decisionsInterpretHydeNode)

    .addNode("ValidationAgent", validationNode)
    .addNode("WebSearchAgent", webSearchNode)
    .addNode("HydeAgent", hydeNode)
    .addNode("CriticalAgent", criticalNode)
    .addNode("FormattingAgent", formattingNode);

  // Définir les connexions dans le graphe
  // Définir les connexions dans le graphe
  workflow.addEdge(START, "ReflectionAgent");
  workflow.addConditionalEdges("ReflectionAgent", shouldContinue);

  /* TEST UNITAIRE
  workflow.addEdge("Supervisor", "DecisionsAgent");
  workflow.addEdge("DecisionsAgent", "DecisionsThinkingAgent");
  workflow.addEdge("DecisionsThinkingAgent", "ValidationAgent");*/

  // Boucle Supervisor aux agents
  workflow.addConditionalEdges(
    "Supervisor",
    () => ["DecisionsAgent", "WebSearchAgent", "HydeAgent"]//, "WebSearchAgent", "HydeAgent", "DecisionsAgent"] // C'EST ICI QUE JE LANCE LES GRAPHS ? + GERER COMMENT LEUR FAIRE PUTAIN DE PASSER LES STATE POUR BIEN DERTERMINER
  );

  workflow.addEdge("HydeAgent", "DoctrinesInterpretHydeAgent");
  workflow.addEdge("DoctrinesInterpretHydeAgent", "ValidationAgent");
  workflow.addEdge("DecisionsAgent", "DecisionsThinkingAgent");
  workflow.addEdge("DecisionsThinkingAgent", "ValidationAgent");
  workflow.addEdge("WebSearchAgent", "ValidationAgent");
  workflow.addEdge("ValidationAgent", "FormattingAgent");
  //workflow.addEdge("CriticalAgent", "FormattingAgent");
  workflow.addEdge("FormattingAgent", END);

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}
