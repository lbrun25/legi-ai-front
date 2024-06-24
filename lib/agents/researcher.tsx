import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, ToolCallPart, ToolResultPart, streamText } from 'ai'
import { getTools } from './tools'
import { getModel, transformToolMessages } from '../utils'
import { AnswerSection } from '@/components/answer-section'
import { AnswerSectionGenerated } from '@/components/answer-section-generated'
import {stripIndent} from "common-tags";

export async function researcher(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamableText: ReturnType<typeof createStreamableValue<string>>,
  messages: CoreMessage[],
  useSpecificModel?: boolean
) {
  let fullResponse = ''
  let hasError = false

  // Transform the messages if using Ollama provider
  let processedMessages = messages
  const useOllamaProvider = !!(
    process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
  )
  if (useOllamaProvider) {
    processedMessages = transformToolMessages(messages)
  }
  const includeToolResponses = messages.some(message => message.role === 'tool')
  const useSubModel = useOllamaProvider && includeToolResponses

  const answerSection = <AnswerSection result={streamableText.value} />
  const currentDate = new Date().toLocaleString()
  const result = await streamText({
    model: getModel(useSubModel),
    maxTokens: 2500,
    system: stripIndent`
      1. Compréhension de la Requête :
      - Analyser et comprendre la question posée par l'utilisateur.
      - Identifier les mots-clés et les concepts juridiques principaux de la requête.
      
      2.Recherche d'Articles de Loi :
      - Utiliser la fonction getMatchedArticles pour rechercher des articles pertinents dans la base de données des Codes de loi.
      - Entrer les mots-clés et les concepts identifiés dans la requête pour obtenir des correspondances basées sur la relation sémantique.
      
      3. Classement par Similitude :
      - La fonction getMatchedArticles renvoie les articles classés par ordre de similitude.
      - Assurer que les articles retournés sont effectivement pertinents par rapport à la question posée.
      
      4. Présentation de la Réponse :
      - Fournir une liste des articles de loi obtenus, en commençant par celui qui est le plus pertinent selon le classement de getMatchedArticles.
      - Pour chaque article, inclure une brève explication de sa pertinence par rapport à la question posée.
      - Si nécessaire, donner un résumé des dispositions légales les plus importantes pour répondre à la question.
      
      5. Éclaircissements et Suivi :
      - Inviter l'utilisateur à demander des éclaircissements ou des informations supplémentaires si nécessaire.
      - Proposer d'autres articles de loi ou des explications détaillées en fonction des demandes de suivi.
    `,
    messages: processedMessages,
    tools: getTools({
      uiStream,
      fullResponse
    })
  }).catch(err => {
    hasError = true
    fullResponse = 'Error: ' + err.message
    streamableText.update(fullResponse)
  })

  // If the result is not available, return an error response
  if (!result) {
    return { result, fullResponse, hasError, toolResponses: [] }
  }

  // Process the response
  const toolCalls: ToolCallPart[] = []
  const toolResponses: ToolResultPart[] = []
  for await (const delta of result.fullStream) {
    switch (delta.type) {
      case 'text-delta':
        if (delta.textDelta) {
          fullResponse += delta.textDelta
          streamableText.update(fullResponse)
        }
        break
      case 'tool-call':
        toolCalls.push(delta)
        break
      case 'tool-result':
        // Append the answer section if the specific model is not used
        if (!useSpecificModel && toolResponses.length === 0 && delta.result) {
          uiStream.append(answerSection)
        }
        if (!delta.result) {
          hasError = true
        }
        toolResponses.push(delta)
        break
      case 'error':
        console.log('Error: ' + delta.error)
        hasError = true
        fullResponse += `\nError occurred while executing the tool`
        break
    }
  }
  messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: fullResponse }, ...toolCalls]
  })

  if (toolResponses.length > 0) {
    // Add tool responses to the messages
    messages.push({ role: 'tool', content: toolResponses })
  }

  return { result, fullResponse, hasError, toolResponses }
}
