"use client";

import {useAssistant, Message} from "ai/react";
import {ChatInput} from "@/components/chat-input";
import {BotMessage} from "@/components/message";
import {Section} from "@/components/section";
import {stripIndent} from "common-tags";

export interface ChatPageProps {
  params: {
    id: string
  }
}

export default function ChatPage({ params }: ChatPageProps) {
  const { status, messages, input, submitMessage, handleInputChange, error } =
    useAssistant({
      api: "/api/assistant",
    });

  console.log('status:', status)
  console.log('messages:', messages)

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {error != null && (
        <div className="relative bg-red-500 text-white px-6 py-4 rounded-md">
          <span className="block sm:inline">
            Error: {(error as any).toString()}
          </span>
        </div>
      )}

      <BotMessage content={content} />

      {messages.map((m: Message) => (
        <div
          key={m.id}
          className="whitespace-pre-wrap"
        >
          <strong>{`${m.role}: `}</strong>
          {m.role !== "data" && (
            <Section title="Answer">
              <BotMessage content={stripIndent(m.content)} />
            </Section>
          )}
          {/*{m.role !== "data" && m.content}*/}
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
      ))}

      {status === "in_progress" && (
        <div className="h-8 w-full max-w-md p-2 mb-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse" />
      )}

      <ChatInput
        messages={messages}
        onChange={handleInputChange}
        isGenerating={status === "in_progress"}
        input={input}
        onSubmit={submitMessage}
        onStopClicked={() => {}}
      />
    </div>
  );
}
