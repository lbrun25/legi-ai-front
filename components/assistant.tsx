import {Message, useAssistant} from "ai/react";
import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import {OpenAI} from "openai";
import {useEffect} from "react";
import {toast} from "sonner";

interface AssistantProps {
  threadId?: string;
  openaiMessages?: OpenAI.Beta.Threads.Message[];
}

type CombinedMessage = OpenAI.Beta.Threads.Message | Message;

// Type guard to check if a message is of type Message
function isMessage(message: CombinedMessage): message is Message {
  return (message as Message).id !== undefined;
}

export const Assistant = ({threadId, openaiMessages}: AssistantProps) => {
  const {status, messages, input, submitMessage, handleInputChange, error} =
    useAssistant({
      api: "/api/assistant",
      threadId: threadId
    });

  useEffect(() => {
    if (error) toast.error(error.toString());
  }, [error]);

  const isGenerating = status === "in_progress";

  // Merge openaiMessages and messages into a single array with unique ids
  // @ts-ignore
  const combinedMessages = [...(openaiMessages ?? []), ...(messages ?? [])].reduce(
    (acc: Message[], curr: CombinedMessage) => {
      if (!acc.find((message) => message.id === curr.id)) {
        if (isMessage(curr)) {
          acc.push(curr);
        }
      }
      return acc;
    },
    [] as Message[]
  );

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto">
      {error != null && (
        <div className="relative bg-red-500 text-white px-6 py-4 rounded-md">
          <span className="block sm:inline">
            Error: {(error as any).toString()}
          </span>
        </div>
      )}

      {combinedMessages.map((m) => {
        // if it is an array means it is a message fetched from openai API used for the history
        const content = Array.isArray(m.content) ? m.content[0].text.value : m.content;
        return (
          <div key={m.id}>
            <strong>{`${m.role}: `}</strong>
            {m.role !== "data" && (
              <BotMessage
                content={content}
                isGenerating={isGenerating}
              />
            )}
            {m.role === "data" && (
              <>
                {(m.data as any).description}
                <br />
                <pre className={"bg-gray-200"}>
                  {JSON.stringify(m.data, null, 2)}
                </pre>
              </>
            )}
            <br />
            <br />
          </div>
        );
      })}

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
