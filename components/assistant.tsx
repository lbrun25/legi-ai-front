import {Message, useAssistant} from "ai/react";
import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import {OpenAI} from "openai";
import {FormEvent, useEffect, useState} from "react";
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
  const {status, messages, input, submitMessage, handleInputChange, error, threadId: currentThreadId} =
    useAssistant({
      api: "/api/assistant",
      threadId: threadId,
    });
  const [isGenerating, setIsGenerating] = useState(status === "in_progress");
  const [hasBeenGenerated, setHasBeenGenerated] = useState(false);
  const [combinedMessages, setCombinedMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (error) toast.error(error.toString());
  }, [error]);

  useEffect(() => {
    const fetchLastMessage = async (): Promise<OpenAI.Beta.Threads.Message | null> => {
      setIsGenerating(true);
      try {
        const fromThreadId = threadId ? threadId : currentThreadId;
        console.log("fetchLastMessage fromThreadId:", fromThreadId)
        const response = await fetch(`/api/threads/${fromThreadId}/messages`);
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        console.log("fetch last message:", data)
        if (combinedMessages[combinedMessages.length - 1] === data[0])
          return null;
        // Create a new array with updated last item
        const updatedMessages = [...combinedMessages];
        updatedMessages[combinedMessages.length - 1] = data[0]
        setCombinedMessages(updatedMessages);
        return data[0]
      } catch (error) {
        console.error('fetchLastMessage err:', error)
        return null;
      } finally {
        setIsGenerating(false);
      }
    }

    if (status === "awaiting_message") {
      if (hasBeenGenerated) {
        const intervalId = setInterval(async () => {
          const lastMessage = await fetchLastMessage();
          if (lastMessage) {
            clearInterval(intervalId);
            console.log('Content fetched:', lastMessage);
          }
        }, 200);
      }
    } else if (status === "in_progress") {
      if (!hasBeenGenerated) setHasBeenGenerated(true);
      if (!isGenerating) setIsGenerating(true);
    } else {
      setIsGenerating(false);
    }
  }, [status]);

  useEffect(() => {
    // Merge openaiMessages and messages into a single array with unique ids
    // @ts-ignore
    console.log("messages:", messages)
    setCombinedMessages(
      [...(openaiMessages ?? []), ...(messages ?? [])].reduce(
        (acc: Message[], curr: CombinedMessage) => {
          if (!acc.find((message) => message.id === curr.id)) {
            if (isMessage(curr)) {
              acc.push(curr);
            }
          }
          return acc;
        },
        [] as Message[]
      )
    )
  }, [openaiMessages, messages]);

  console.log("status:", status)
  console.log("isGenerating:", isGenerating)

  const handleOnSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasBeenGenerated(false);
    submitMessage();
  }

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto">
      {error != null && (
        <div className="relative bg-red-500 text-white px-6 py-4 rounded-md">
          <span className="block sm:inline">
            Error: {(error as any).toString()}
          </span>
        </div>
      )}

      {combinedMessages.map((m, index) => {
        // if it is an array means it is a message fetched from openai API used for the history
        const content = Array.isArray(m.content) ? m.content[0]?.text?.value : m.content;
        if (!content) {
          console.error("content undefined: m.content:", m.content);
          return null;
        }
        const prevMessage = combinedMessages[index - 1];
        const prevMessageIsAssistant = prevMessage?.role === "assistant";
        if (prevMessageIsAssistant && m.role === "assistant") {
          console.warn("the previous message is already from the assistant");
          return null;
        }

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
          onSubmit={handleOnSubmit}
          onStopClicked={() => {
          }}
        />
      </div>
    </div>
  );
}
