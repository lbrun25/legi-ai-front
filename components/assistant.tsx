import {Message, useAssistant} from "ai/react";
import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import {OpenAI} from "openai";
import {TextContentBlock} from "openai/resources/beta/threads/messages";

interface AssistantProps {
  threadId?: string;
  openaiMessages?: OpenAI.Beta.Threads.Message[];
}

export const Assistant = ({threadId, openaiMessages}: AssistantProps) => {
  const {status, messages, input, submitMessage, handleInputChange, error} =
    useAssistant({
      api: "/api/assistant",
      threadId: threadId
    });

  const isGenerating = status === "in_progress";

  console.log('openaiMessages:', openaiMessages)

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto">
      {error != null && (
        <div className="relative bg-red-500 text-white px-6 py-4 rounded-md">
          <span className="block sm:inline">
            Error: {(error as any).toString()}
          </span>
        </div>
      )}

      {openaiMessages && openaiMessages.map((m) => (
        <div
          key={m.id}
        >
          <strong>{`${m.role}: `}</strong>
          <BotMessage
            content={(m.content[0] as TextContentBlock).text?.value}
            isGenerating={isGenerating}
          />
          <br/>
          <br/>
        </div>
      ))}

      {messages.map((m: Message) => (
        <div
          key={m.id}
        >
          <strong>{`${m.role}: `}</strong>
          {m.role !== "data" && <BotMessage content={m.content} isGenerating={isGenerating}/>}
          {m.role === "data" && (
            <>
              {(m.data as any).description}
              <br/>
              <pre className={"bg-gray-200"}>
                {JSON.stringify(m.data, null, 2)}
              </pre>
            </>
          )}
          <br/>
          <br/>
        </div>
      ))}

      {status === "in_progress" && (
        <div className="h-8 w-full max-w-md p-2 mb-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"/>
      )}

      <div
        className="fixed bottom-0 pb-8 left-0 right-0 mx-auto flex flex-col items-center justify-center bg-background">
        <ChatInput
          messages={messages}
          onChange={handleInputChange}
          isGenerating={isGenerating}
          input={input}
          onSubmit={submitMessage}
          onStopClicked={() => {
          }}
        />
      </div>
    </div>
  );
}
