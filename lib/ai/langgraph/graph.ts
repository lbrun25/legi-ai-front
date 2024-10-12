"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  DecisionsAgentPrompt,
  //SearchAgentPrompt, // Import du prompt pour l'agent intermédiaire
  //DecisionsAnalystAgent,
  FormattingPrompt,
  ArticlesAgentPrompt,
  ArticlesIntermediaryAgent,
  ArticlesThinkingAgent,
  DoctrinesAgentPrompt,
  DoctrinesIntermediaryPrompt,
  ReflectionAgentPrompt,
  DecisionsThinkingAgent,
  SupervisorPrompt,
  ValidationAgentPrompt
} from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDecisions, listDecisions } from "@/lib/ai/tools/getMatchedDecisions";
import { getMatchedArticles } from "@/lib/ai/tools/getMatchedArticles";
import { getMatchedDoctrinesTool } from "@/lib/ai/tools/getMatchedDoctrines";
import { getArticleByNumber, getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";

let cachedApp: any = null;

const GraphAnnotation = Annotation.Root({
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
  queriesDecisionsList: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
});

const createGraph = async () => {
  const members = ["ArticlesAgent", "DecisionsAgent", "DoctrinesAgent"] as const;

  const options = ["FINISH", ...members];

  const routingTool = {
    name: "route",
    description: "Sélectionnez les membres qui semblent les plus qualifiés pour répondre au sommaire transmis.",
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
  console.time("call supervisor");
  console.time("call decisionsAgent");
  console.time("call decisionsAgent invoke");
  console.time("call decisionsIntermediaryAgent");
  console.time("call decisionsIntermediaryAgent invoke");
  console.time("call decisionsIntermediaryAgent2");
  console.time("call decisionsIntermediaryAgent2 invoke");
  console.time("call validationAgent");
  console.time("call AnalystAgent");
  console.time("call DecisionsThinkingAgent invoke");
  console.time("call DecisionsAnalystAgent invoke");
  console.time("call validationAgent invoke");
  console.time("call formattingAgent");
  console.time("call formatting invoke");
  console.time("call reflection");
  console.time("call ThinkingAgent");
  console.time("input send to ThinkingAgent");

  // ReflectionAgent
  const reflectionPrompt = ChatPromptTemplate.fromMessages([
    ["system", ReflectionAgentPrompt],
    new MessagesPlaceholder("messages"),
  ])
  const summaryTool = {
    name: "summary",
    description: "Établit un sommaire de la demande de l'utilisateur",
    schema: z.object({
      summary: z.string(),
    }),
  }

  const reflectionChain = reflectionPrompt
    .pipe(llm.bindTools([summaryTool]))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.timeEnd("call reflection");
      console.log('Sommaire:', JSON.stringify(x));
      return (x[0].args);
    });

  // Supervisor
  const supervisorChain = formattedPrompt
    .pipe(llm.bindTools(
      [routingTool],
      {
        tool_choice: "route",
      },
    ))
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => {
      console.timeEnd("call supervisor");
      console.log('Supervisor décision:', JSON.stringify(x));
      return (x[0].args);
    });

    // Définition du Prompt pour ArticlesAgent
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
  .pipe(llm.bindTools([queryListTool]))
  .pipe(new JsonOutputToolsParser())
  .pipe((output) => {
    console.timeEnd("call articles");
    console.log('Liste des requêtes:', JSON.stringify(output));
    return output[0].args; // Retourne les requêtes générées
  });

  /* decisions agents */

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
    .pipe(llm.bindTools([queryDecisionsListTool]))
    .pipe(new JsonOutputToolsParser())
    .pipe((output) => {
      console.timeEnd("call decisions");
      console.log('Liste des requêtes:', JSON.stringify(output));
      return output[0].args; // Retourne les requêtes générées
    });

/* decisionsThinkingAgent : */

  const decisionsThinkingNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call ThinkingAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    async function removeDuplicates(numbers: bigint[]): Promise<bigint[]> {
      // Utilisation d'un Set pour éliminer les doublons
      const uniqueNumbers = new Set(numbers);
    
      // Conversion du Set en tableau
      return Array.from(uniqueNumbers);
    }
    
    async function getExpertMessages() {
      const expertMessages: string[] = [];
      let rankFusionIds: bigint[] = [];
    
      // Utilisation de Promise.all pour exécuter les requêtes en parallèle
      const rankFusionIdsPromises = state.queriesDecisionsList.map(async (query) => {
        let rankFusionIdsTemp = await getMatchedDecisions(query);
    
        // Si la réponse est vide, on tente de la récupérer à nouveau
        if (!rankFusionIdsTemp) {
          await delay(100); // Attente, mais cela peut ne pas être nécessaire
          rankFusionIdsTemp = await getMatchedDecisions(query);
        }
        
        return rankFusionIdsTemp;
      });
    
      // Attente que toutes les promesses soient terminées
      const rankFusionIdsResults = await Promise.all(rankFusionIdsPromises);
    
      // Regroupement de tous les résultats dans un seul tableau
      rankFusionIdsResults.forEach(result => rankFusionIds.push(...result));
    
      // Suppression des doublons
      const listIds = await removeDuplicates(rankFusionIds);
    
      // Création du message expert
      const message = await listDecisions(state.summary, listIds);
      expertMessages.push(message);
    
      return expertMessages;
    }

    const expertMessages = await getExpertMessages();
    //console.log("[EXPERTS] :\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DecisionsThinkingAgent)
      .format({
        summary: state.summary,
      });

    const input: any = [
      systemMessage,
      ...expertMessages
    ];

    try {
      console.timeEnd("input send to ThinkingAgent");
      console.log("[DecisionsThinkingNode] input :", input)
      const result = await llm.invoke(input, config);
      console.timeEnd("call DecisionsThinkingAgent invoke");
      const lastMessage = result.content
      console.log("decisionsThinkingAgent Content :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DecisionsThinkingAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisionsThinkingAgent agent:", error);
      return { messages: [] }
    }
  };


  const articlesThinkingNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call ArticlesThinkingAgent");
  // ICI FAUT QUE JE VOIS POUR GERER LES INPUT CAR SI CONV ÇA PREND PAS EN COMPTE JE CROIS !!!!!!!!!!!!!!!!!!!!! + VOIR SI JE LAISSE STRINGLIGY + voir si ici besoin que je vide le state des querylist (pour gerer si nvx message user
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    /*async function querieSize(queriesArticles: string[]) {
      let i = 0;

      while(querieSize[i + 1] !=)

    }*/
      async function getArticlesExpertMessages() {
        const expertMessages: string[] = [];
      
        // Convertir les appels à getArticleByNumber2 et getMatchedArticles en promises pour un traitement parallèle
        const promises = state.queries.map(async (query) => {
          let message;
      
          if (query.includes("getArticleByNumber")) {
            message = await getArticleByNumber2(query);
            if (!message) {
              await delay(100); // Attente avant de réessayer si nécessaire
              message = await getArticleByNumber2(query);
            }
          } else {
            message = await getMatchedArticles(query);
            if (!message) {
              await delay(1000); // Attente avant de réessayer si nécessaire
              message = await getMatchedArticles(query);
            }
          }
          return JSON.stringify(message);
        });
      
        const results = await Promise.all(promises);
      
        expertMessages.push(...results);
      
        return expertMessages;
      }
      

    const expertMessages = await getArticlesExpertMessages();
    //console.log("[EXPERTS] :\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ArticlesThinkingAgent)
      .format({
        summary: state.summary,
      });

    const input: any = [
      systemMessage,
      ...expertMessages
    ];

    try {
      console.timeEnd("input send to ThinkingAgent");
      const result = await llm.invoke(input, config);
      console.log("[ArticlesThinkingNode] input :", input)
      console.timeEnd("call ArticlesThinkingAgent invoke");
      const lastMessage = result.content
      console.log("ArticlesThinkingAgent Content :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "ArticlesThinkingAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisionsThinkingAgent agent:", error);
      return { messages: [] }
    }
  };
/* DOCTRINE */

      // Définition du Prompt pour ArticlesAgent
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
  .pipe(llm.bindTools([doctrineRequestListTool]))
  .pipe(new JsonOutputToolsParser())
  .pipe((output) => {
    console.timeEnd("call doctrineChain");
    console.log('Liste des requêtes en matièere de doctrine :', JSON.stringify(output));
    return output[0].args; // Retourne les requêtes générées
  });

  //Doctrine Agent Intermédiaire
  const doctrinesIntermediaryAgent = createReactAgent({
    llm,
    tools: [getMatchedDoctrinesTool],
    messageModifier: new SystemMessage(DoctrinesIntermediaryPrompt)
  })
  const doctrinesIntermediaryNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call doctrinesAgent");
    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DoctrinesIntermediaryPrompt)
      .format({
        requestDoctrines: state.requestDoctrines,
      });
    const input = [
      systemMessage,
    ]
    try {

      const result = await doctrinesIntermediaryAgent.invoke({messages: input}, config);
      console.timeEnd("call doctrinesIntermediaryAgent invoke")
      const lastMessage = result.messages[result.messages.length - 1];
      //console.log("DoctrinesIntermediaryNode Content :", lastMessage.content);
      return {
        messages: [
          new HumanMessage({ content: lastMessage.content, name: "DoctrinesIntermediaryAgent" }),
        ],
      };
    } catch(error) {
      console.error("error when invoking doctrines agent:", error);
      return {
        messages: [],
      }
    }
  };

  // ValidationAgent
  const validationNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call validationAgent");

    // Vérifier que toutes les réponses des agents sont présentes avant de lancer la validation
    const articlesThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "ArticlesThinkingAgent"
    );
    const decisionsThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "DecisionsThinkingAgent"
    );
    const doctrineThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "doctrineThinkingAgent"
    );

    // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
    if (!decisionsThinkingAgentMessage || !articlesThinkingAgentMessage) { //|| !doctrineThinkingAgentMessage) // 
      console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }
    
    const expertMessages = [decisionsThinkingAgentMessage, articlesThinkingAgentMessage]; //, articlesThinkingAgentMessage
    console.log("[ValidationNODE] Message des experts:\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ValidationAgentPrompt)
      .format({
        summary: state.summary,
      });

    const input: any = [
      systemMessage,
      ...expertMessages,
    ];

    try {
      const result = await llm.invoke(input, config);
      console.log("Validation Agent response :", result.content)
      console.timeEnd("call validationAgent invoke");
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "ValidationAgent" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking validation agent:", error);
      return { messages: [] }
    }
  };


// FormattingAgent
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

  // Si validationMessage est vide, ne rien faire
  if (!validationMessage) {
    console.log("Aucune réponse de ValidationAgent, le formattingNode ne fait rien.");
    return { messages: [] };  // Renvoyer un état vide pour indiquer qu'aucune action n'a été prise
  }

  try {
    // Construire l'entrée pour le Formatting Agent avec summary et validation response
    const input = [
      new SystemMessage({ content: FormattingPrompt }),
      new HumanMessage({ content: validationMessage.content, name: "ValidationAgent" }), // validationMessage
    ];

    console.log("formatting input:", input);

    // Appeler le modèle LLM avec l'entrée modifiée
    const result = await llm
      .withConfig({ tags: ["formatting_agent"] })
      .invoke(input, config);

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
    .addNode("DecisionsAgent", decisionsChain)
    .addNode("ArticlesAgent", articlesChain)
    //.addNode("DoctrinesAgent", doctrinesChain)
    .addNode("ArticlesThinkingAgent", articlesThinkingNode)
    //.addNode("DoctrinesIntermediaryAgent", doctrinesIntermediaryNode)
    .addNode("DecisionsThinkingAgent", decisionsThinkingNode)
    .addNode("ValidationAgent", validationNode)
    .addNode("FormattingAgent", formattingNode);

  // Définir les connexions dans le graphe
  workflow.addEdge(START, "ReflectionAgent");
  workflow.addEdge("ReflectionAgent", "Supervisor"); // ReflectionAgent envoie au Supervisor

  // Connexions du Supervisor aux agents
  workflow.addEdge("Supervisor", "ArticlesAgent");
  workflow.addEdge("Supervisor", "DecisionsAgent");
  //workflow.addEdge("Supervisor", "DoctrinesAgent");

  // Connexion des Agent aux IntermediaryAgent
  workflow.addEdge("ArticlesAgent", "ArticlesThinkingAgent");
  workflow.addEdge("DecisionsAgent", "DecisionsThinkingAgent");
  //workflow.addEdge("DoctrinesAgent", "DoctrinesIntermediaryAgent");

  // Connexion des agents spécialisés au ValidationAgent
  //workflow.addEdge("DoctrinesIntermediaryAgent", "ValidationAgent");
  workflow.addEdge("ArticlesThinkingAgent", "ValidationAgent");
  workflow.addEdge("DecisionsThinkingAgent", "ValidationAgent");
  // Connexion du ValidationAgent au FormattingAgent
  workflow.addEdge("ValidationAgent", "FormattingAgent");
  workflow.addEdge("FormattingAgent", END);

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}
