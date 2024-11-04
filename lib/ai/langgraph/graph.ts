"use server"
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  DecisionsAgentPrompt,
  //SearchAgentPrompt, // Import du prompt pour l'agent intermédiaire
  //DecisionsAnalystAgent,
  FormattingPrompt,
  ArticlesAgentPrompt,
  ArticlesAgentPrompt2,
  ArticlesThinkingAgent,
  ArticlesThinkingAgent2,
  DoctrinesAgentPrompt,
  DoctrinesIntermediaryPrompt,
  ReflectionAgentPrompt,
  DecisionsThinkingAgent,
  SupervisorPrompt,
  ValidationAgentPrompt,
  CriticalAgentPrompt
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
import { getArticleByNumber, getArticleByNumber2 } from "@/lib/ai/tools/getArticleByNumber";
import { mergeResults } from '../../utils/mergeResults'

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

  const llm2 = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o",
    configuration: {
      apiKey: process.env.OPENAI_API_KEY!,
    }
  });

  console.time("call reflectionAgent");
  console.time("call supervisor");
  console.time("call output articlesChain");
  console.time("call output doctrinesChain");
  console.time("call output decisionsChain");
  console.time("call DecisionsThinkingAgent");
  console.time("[DecisionsThinking] : Start searching decisions in DB.");
  console.time("[DecisionsThinking] : Done searching decisions in DB.");
  console.time("[DecisionsThinking] : Data Ready, send to LLM");
  console.time("[DecisionsThinking] : invoke");
  console.time("Call ArticlesThinkingAgent");
  console.time("[ArticlesThinkingAgent] : Start searching articles in DB.");
  console.time("[ArticlesThinkingAgent] : Done searching articles in DB.");
  console.time("[ArticlesThinkingAgent] : Data Ready, send to LLM");      
  console.time("[ArticlesThinkingAgent] : invoke");
  console.time("Call doctrinesThinkingAgent");
  console.time("[DoctrinesThinkingAgent] : Start searching doctrines in DB.");
  console.time("[DoctrinesThinkingAgent] : Done searching doctrines in DB.");
  console.time("[DoctrinesThinking] : Data Ready, send to LLM");
  console.time("[DoctrinesThinking] : invoke")
  console.time("call validationAgent");
  console.time("[ValidationAgent] : Data ready, send to LLM.");
  console.time("[ValidationAgent] : invoke");
  console.time("call formattingAgent");

  /*
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
  console.timeEnd("Done calling for décisions")*/




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
    console.timeEnd("call reflectionAgent");
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
  function shouldContinue(state: typeof GraphAnnotation.State): "Supervisor" | typeof END {
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
      //console.log('Supervisor décision:', JSON.stringify(x));
      return (x[0].args);
    });

/* TEST */

const articlesPrompt2 = ChatPromptTemplate.fromMessages([
  ["system", ArticlesAgentPrompt2], // Votre prompt spécifique pour ArticlesAgent
  new MessagesPlaceholder("messages"),
]);

// Définition de l'outil pour ArticlesAgent
const queryListTool2 = {
  name: "queries_list",
  description: "Établit une liste de requêtes basée sur la demande de l'utilisateur",
  schema: z.object({
    queries2: z.array(z.string()),
  }),
};

// Création de la chaîne de traitement pour ArticlesAgent
const articlesChain2 = articlesPrompt2
  .pipe(llm.bindTools([queryListTool2]))
  .pipe(new JsonOutputToolsParser())
  .pipe((output) => {
    console.timeEnd("call output articlesChain");
    console.log('[articlesChain2] Liste des requêtes:', JSON.stringify(output));
    return output[0].args; // Retourne les requêtes générées
  });



/* FIN TEST */
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
    console.timeEnd("call output articlesChain");
    console.log('[articlesChain] Liste des requêtes:', JSON.stringify(output));
    return output[0].args; // Retourne les requêtes générées
  });

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
    console.timeEnd("call output doctrinesChain");
    //console.log('Liste des requêtes en matièere de doctrine :', JSON.stringify(output));
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
      console.timeEnd("call output decisionsChain");
      //console.log('[decisionsChain] Liste des requêtes:', JSON.stringify(output));
      return output[0].args; // Retourne les requêtes générées
    });

/* decisionsThinkingAgent : */

  const decisionsThinkingNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("call DecisionsThinkingAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    async function removeDuplicates(numbers: bigint[]): Promise<bigint[]> {
      const uniqueNumbers = new Set(numbers);
      return Array.from(uniqueNumbers);
    }

    async function getExpertMessages() {
      const expertMessages: string[] = [];
      let rankFusionIds: bigint[] = [];

      console.timeEnd("[DecisionsThinking] : Start searching decisions in DB.");
      
      const rankFusionIdsPromises = state.queriesDecisionsList.map(async (query) => {
        let rankFusionIdsTemp = await getMatchedDecisions(query);
        let retries = 0;
        const maxRetries = 2; // On peut ajuster cette valeur selon les besoins
        while (!rankFusionIdsTemp && retries < maxRetries) {
            await delay(100); // Attente, ajuster si nécessaire
            rankFusionIdsTemp = await getMatchedDecisions(query);
            retries++;
        }

        if (!rankFusionIdsTemp) {
            console.error(`Failed to retrieve decisions for query: ${query}`);
            return []; // ou gérer différemment selon le besoin
        }
        return rankFusionIdsTemp;
    });
    console.timeEnd("[DecisionsThinking] : Done searching decisions in DB.");
      const rankFusionIdsResults = await Promise.all(rankFusionIdsPromises);
      rankFusionIdsResults.forEach(result => rankFusionIds.push(...result));
      console.time("[DecisionsThinking] : Cleaning decisions.");
      const listIds = await removeDuplicates(rankFusionIds);
      const message: any = await listDecisions(state.summary, listIds);
      console.timeEnd("[DecisionsThinking] : Cleaning decisions.");
      expertMessages.push(message);
      return expertMessages;
    }

    const expertMessages = await getExpertMessages();
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
      console.timeEnd("[DecisionsThinking] : invoke");
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

  /* TEST */
  const articlesThinkingNode2 = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("Call ArticlesThinkingAgent2");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("queries :", state.queries2)
      async function getArticlesExpertMessages() {
        const expertMessages: string[] = [];
        console.timeEnd("[ArticlesThinkingAgent2] : Start searching articles in DB.");

        // Convertir les appels à getArticleByNumber2 et getMatchedArticles en promises pour un traitement parallèle
        const promises = state.queries2.map(async (query) => {
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
        const mergedResults = await mergeResults(results) // merge les ids des memes codes sans les doublons
        console.timeEnd("[ArticlesThinkingAgent2] : Done searching articles in DB.");

        for (const result of mergedResults) {
          const { codeName, listIDs } = result;
          const cleanedResult = await articlesCleaned(codeName, listIDs, state.summary);
          if (cleanedResult) {
            expertMessages.push(cleanedResult);
          }
        }
        return expertMessages;
      }

    const expertMessages = await getArticlesExpertMessages();

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ArticlesThinkingAgent2)
      .format({});

    const summary = state.summary;

    const input: any = [
      systemMessage,
      summary,
      ...expertMessages
    ];

    try {
      console.timeEnd("[ArticlesThinkingAgent2] : Data Ready, send to LLM");
      const result = await llm.invoke(input, config);
      console.log("[ArticlesThinkingNode2] input :", input)
      console.timeEnd("[ArticlesThinkingAgent2] : invoke");
      const lastMessage = result.content
      console.log("ArticlesThinkingAgent2 Content :", lastMessage)
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "ArticlesThinkingAgent2" }),
        ],
      };
    } catch (error) {
      console.error("error when invoking decisionsThinkingAgent agent:", error);
      return { messages: [] }
    }
  };

/* FIN TEST */

  const articlesThinkingNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("Call ArticlesThinkingAgent");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const doctrineThinkingAgentMessage = state.messages.find(
      (msg) => msg.name === "DoctrinesThinkingAgent"
    );

    if (!doctrineThinkingAgentMessage)
    {
      console.log("[ArticleNode] : Doctrine non reçue.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    console.log("queries :", state.queries)
      async function getArticlesExpertMessages() {
        const expertMessages: string[] = [];
        console.timeEnd("[ArticlesThinkingAgent] : Start searching articles in DB.");

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
        const mergedResults = await mergeResults(results) // merge les ids des memes codes sans les doublons
        console.timeEnd("[ArticlesThinkingAgent] : Done searching articles in DB.");

        for (const result of mergedResults) {
          const { codeName, listIDs } = result;
          const cleanedResult = await articlesCleaned(codeName, listIDs, state.summary);
          if (cleanedResult) {
            expertMessages.push(cleanedResult);
          }
        }
        return expertMessages;
      }


    const expertMessages = await getArticlesExpertMessages();

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(ArticlesThinkingAgent)
      .format({});

    const summary = state.summary;

    const input: any = [
      systemMessage,
      doctrineThinkingAgentMessage,
      ...expertMessages
    ];

    try {
      console.timeEnd("[ArticlesThinkingAgent] : Data Ready, send to LLM");
      const result = await llm.invoke(input, config);
      console.log("[ArticlesThinkingNode] input :", input)
      console.timeEnd("[ArticlesThinkingAgent] : invoke");
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

/*
  //Doctrine Agent Intermédiaire
  const doctrinesIntermediaryAgent = createReactAgent({
    llm,
    tools: [getMatchedDoctrinesTool],
    messageModifier: new SystemMessage(DoctrinesIntermediaryPrompt)
  })*/

  
  const doctrinesIntermediaryNode = async (
    state: typeof GraphAnnotation.State,
    config?: RunnableConfig,
  ) => {
    console.timeEnd("Call doctrinesThinkingAgent");
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    async function removeDuplicates(numbers: bigint[]): Promise<bigint[]> {
      const uniqueNumbers = new Set(numbers);
      return Array.from(uniqueNumbers);
    }

    async function getDoctrineExpertMessages() {
      const doctrineExpertMessages: string[] = [];
      let rankFusionIdsDoctrine: bigint[] = [];

      // Utilisation de Promise.all pour exécuter les requêtes en parallèle
      const rankFusionIdsPromises = state.requestDoctrines.map(async (query) => {
        let rankFusionIdsTemp = await getMatchedDoctrines(query);
        if (!rankFusionIdsTemp) {
          await delay(100);
          rankFusionIdsTemp = await getMatchedDoctrines(query);
        }

        return rankFusionIdsTemp;
      });

      // Attente que toutes les promesses soient terminées
      const rankFusionIdsResults = await Promise.all(rankFusionIdsPromises);
      // Regroupement de tous les résultats dans un seul tableau
      rankFusionIdsResults.forEach(result => rankFusionIdsDoctrine.push(...result));
      // Suppression des doublons
      const doctrineListIds = await removeDuplicates(rankFusionIdsDoctrine);
      //console.log("After doctrines dupplicates removed :", doctrineListIds)
      const message = await listDoctrines(state.summary, doctrineListIds);
      doctrineExpertMessages.push(message);

      return doctrineExpertMessages;
    }

    //const summary = state.summary

    console.timeEnd("[DoctrinesThinkingAgent] : Start searching doctrines in DB.");
    const expertDoctrinesMessages = await getDoctrineExpertMessages();
    console.timeEnd("[DoctrinesThinkingAgent] : Done searching doctrines in DB.");

    //console.log("[DOCTRINES EXPERTS] :\n", expertMessages);

    const systemMessage = await SystemMessagePromptTemplate
      .fromTemplate(DoctrinesIntermediaryPrompt)
      .format({
        summary: state.summary,
      });

    const inputs = [
      systemMessage,
      ...expertDoctrinesMessages
    ]

    try {
      console.timeEnd("[DoctrinesThinking] : Data Ready, send to LLM");
      //console.log("[DoctrinesThinkingAgents] inputs : ", inputs)
      const result = await llm.invoke(inputs, config);
      console.timeEnd("[DoctrinesThinking] : invoke")
      const lastMessage = "Résumé de la demande de l'utilisateur :" + state.summary + "\n\n" + "Résultat de la recherche dans la doctrine :\n" + result.content
      console.log("[DoctrinesThinkingAgents] Content :", lastMessage);
      return {
        messages: [
          new HumanMessage({ content: result.content, name: "DoctrinesThinkingAgent" }),
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
      (msg) => msg.name === "DoctrinesThinkingAgent"
    );

    // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
    if (!decisionsThinkingAgentMessage || !articlesThinkingAgentMessage) //
    {
      console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
      return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
    }

    const expertMessages = [articlesThinkingAgentMessage, decisionsThinkingAgentMessage] //, doctrineThinkingAgentMessage]; //, articlesThinkingAgentMessage
    //console.log("[ValidationNODE] Message des experts:\n", expertMessages);

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
      console.timeEnd("[ValidationAgent] : Data ready, send to LLM.");
      const result = await llm.invoke(input, config);
      console.log("Validation Agent response :", result.content)
      console.timeEnd("[ValidationAgent] : invoke");
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

    // ValidationAgent
    const criticalNode = async (
      state: typeof GraphAnnotation.State,
      config?: RunnableConfig,
    ) => {
      console.timeEnd("call critical Node");
  
      // Vérifier que toutes les réponses des agents sont présentes avant de lancer la validation
      const validationMessage = state.messages.find(
        (msg) => msg.name === "ValidationAgent"
      );
      const doctrineThinkingAgentMessage = state.messages.find(
        (msg) => msg.name === "DoctrinesThinkingAgent"
      );
  
      // Si l'un des messages attendus n'est pas encore présent, renvoyer un état en attente
      if (!validationMessage || !doctrineThinkingAgentMessage)
      {
        console.log("[ValidationNODE] : Un ou plusieurs agents n'ont pas encore répondu.");
        return { messages: [] };  // On renvoie une liste vide pour indiquer que le processus continue d'attendre
      }
  
      const expertMessages = [validationMessage, doctrineThinkingAgentMessage] //, doctrineThinkingAgentMessage]; //, articlesThinkingAgentMessage
      console.log("[Critical Node] Message des experts:\n", expertMessages);
  
      const systemMessage = await SystemMessagePromptTemplate
        .fromTemplate(CriticalAgentPrompt)
        .format({});
  
      const summary = state.summary;
  
      const input: any = [
        systemMessage,
        summary,
        ...expertMessages,
      ];
  
      try {
        const result = await llm.invoke(input, config);
        console.log("Critical Agent response :", result.content)
        console.timeEnd("call criticalagent invoke");
        return {
          messages: [
            new HumanMessage({ content: result.content, name: "CriticalAgent" }),
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
    .addNode("ArticlesAgent2", articlesChain2)
    .addNode("DoctrinesAgent", doctrinesChain)
    .addNode("ArticlesThinkingAgent", articlesThinkingNode)
    .addNode("ArticlesThinkingAgent2", articlesThinkingNode2)
    .addNode("DoctrinesThinkingAgent", doctrinesIntermediaryNode)
    .addNode("DecisionsThinkingAgent", decisionsThinkingNode)
    .addNode("ValidationAgent", validationNode)
    //.addNode("CriticalAgent", criticalNode)
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
    () => ["DoctrinesAgent"] // Retourne les agents à appeler en parallèle
  );

  // Connexion des Agent aux IntermediaryAgent
 // workflow.addEdge("ArticlesAgent2", "ArticlesThinkingAgent2");
  workflow.addEdge("DoctrinesAgent", "DoctrinesThinkingAgent");

  // Connexion des agents spécialisés au ValidationAgent
  workflow.addEdge("DoctrinesThinkingAgent", "ArticlesAgent");
  workflow.addEdge("ArticlesAgent", "ArticlesThinkingAgent");
  //workflow.addEdge("DecisionsThinkingAgent", "ValidationAgent");

  // Connexion du ValidationAgent au FormattingAgent
  //workflow.addEdge("ValidationAgent", "FormattingAgent");
  //workflow.addEdge("CriticalAgent", "FormattingAgent");
  workflow.addEdge("FormattingAgent", END);

  return workflow.compile();
}

export const getCompiledGraph = async () => {
  if (!cachedApp)
    cachedApp = await createGraph();
  return cachedApp;
}

/*
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
      console.log('decisionsAgent result:', result.messages)
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
*/