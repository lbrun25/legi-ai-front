import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  DecisionsAgentPrompt,
  FormattingPrompt,
  ArticlesAgentPrompt,
  ArticlesThinkingAgent,
  DoctrinesAgentPrompt,
  DoctrinesIntermediaryPrompt,
  ReflectionAgentPrompt,
  DecisionsThinkingAgent,
  SupervisorPrompt,
  ValidationAgentPrompt,
} from "@/lib/ai/langgraph/prompt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMatchedDecisions, listDecisions } from "@/lib/ai/tools/getMatchedDecisions";
import { getMatchedArticles, articlesCleaned } from "@/lib/ai/tools/getMatchedArticles";
import { getMatchedDoctrinesTool } from "@/lib/ai/tools/getMatchedDoctrines";
import { getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";
import { mergeResults } from '../../utils/mergeResults'

const AssistantAnnotation = Annotation.Root({
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
  summaryToolCall: Annotation<boolean>({
    reducer: (update) => update, // Remplace simplement le booléen
    default: () => true, // Valeur par défaut à 'true'
  }),

});

export const createAssistantGraph = async () => {
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
      "À partir de la conversation ci-dessus, identifiez qui devrait intervenir ensuite: {options}. Sélectionnez \"FINISH\" si aucune autre action n'est nécessaire.",
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
  console.time("call ArticlesThinkingAgent");
  console.time("call ArticlesThinkingAgent invoke");
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
  console.time("call DecisionsThinkingAgent");
  console.time("input send to ThinkingAgent");
  console.time("[DecisionsThinking] : Data Ready, send to LLM");
  console.time("[ArticlesThinking] : Data Ready, send to LLM");
  console.timeEnd("Start calling for décisions");
  console.timeEnd("Done calling for décisions")


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
    .pipe((x) => {
      console.timeEnd("call reflection");
      const appel = JSON.stringify(x, null, 2)
      const xParsed = JSON.parse(appel);
      if (xParsed.kwargs.tool_call_chunks.length === 0) {
        console.log("tool_call_chunks est vide."); // Summary pas appelé
        console.log("x:", x.content); // => Contenu message agent
        x.content = "[IMPRIMER]" + x.content;
        return (x)
      } else {
        if (xParsed.kwargs.tool_calls.length > 0) {
          const summary = xParsed.kwargs.tool_calls[0].args.summary; // Contient le sommaire fait par l'agent
          console.log("Le summary est :", summary);
          return {summary: summary}
        } else {
          x.content = "[IMPRIMER]" + x.content;
          console.log("tool_calls est vide.");
          return (x);
        }
      }
    });

  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof AssistantAnnotation.State): "Supervisor" | typeof END {
    const summary = state.summary;
    // Vérifie si le tableau de messages est vide
    if (summary === "") {
      console.log('[ShouldContinue] No messages, stopping the chain.');
      return END;
    }
    return "Supervisor";
  }

  /* Supervisor */
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
    state: typeof AssistantAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call DecisionsThinkingAgent");
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

    console.timeEnd("Start calling for décisions");
    const expertMessages = await getExpertMessages();
    console.timeEnd("Done calling for décisions")
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
      console.timeEnd("[DecisionsThinking] : Data Ready, send to LLM");
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
    state: typeof AssistantAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call ArticlesThinkingAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
          // Ajouter directement le message à expertMessages
          if (message) {
            expertMessages.push(message);
          }
          return null; // Retourne null pour ne pas inclure ce message dans results
        } else {
          message = await getMatchedArticles(query);
          if (!message) {
            await delay(1000); // Attente avant de réessayer si nécessaire
            message = await getMatchedArticles(query);
          }
          return message;
        }
      });
      const results = (await Promise.all(promises)).filter((res) => res !== null);
      //console.log("result :", results)
      const mergedResults = await mergeResults(results) // merge les ids des memes codes sans les doublons
      //console.log("merged : ", mergedResults)
      for (const result of mergedResults) {
        const { codeName, listIDs } = result;
        const cleanedResult = await articlesCleaned(codeName, listIDs);
        if (cleanedResult) {
          expertMessages.push(cleanedResult);
        }
      }
      return expertMessages;
    }


    const expertMessages = await getArticlesExpertMessages();
    //console.log("[EXPERTS] :\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ArticlesThinkingAgent)
      .format({});

    const summary = state.summary;

    const input: any = [
      systemMessage,
      summary,
      ...expertMessages
    ];

    try {
      console.timeEnd("[ArticlesThinking] : Data Ready, send to LLM");
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
    state: typeof AssistantAnnotation.State,
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
    state: typeof AssistantAnnotation.State,
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
      .format({});

    const summary = state.summary;

    const input: any = [
      systemMessage,
      summary,
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
    state: typeof AssistantAnnotation.State,
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
  const workflow = new StateGraph(AssistantAnnotation)
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
  workflow.addConditionalEdges("ReflectionAgent", shouldContinue);
  //workflow.addEdge("ReflectionAgent", "Supervisor"); // ReflectionAgent envoie au Supervisor

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
