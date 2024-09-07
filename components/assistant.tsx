import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import React, {FormEvent, useEffect, useRef, useState} from "react";
import {Message, MessageRole} from "@/lib/types/message";
import {updateTitleForThread} from "@/lib/supabase/threads";
import {Spinner} from "@/components/ui/spinner";
import {IncompleteMessage} from "@/components/incomplete-message";
import {VoiceRecordButton} from "@/components/voice-record-button";
import {ProgressChatBar} from "@/components/progress-chat-bar";
import {streamingFetch} from "@/lib/utils/fetch";
import {getMessages, insertMessage} from "@/lib/supabase/message";

interface AssistantProps {
  threadId?: string;
  messages?: Message[];
}

export const Assistant = ({threadId: threadIdParams}: AssistantProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadIdState, setThreadIdState] = useState("");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [hasIncomplete, setHasIncomplete] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!threadIdParams) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const messages = await getMessages(threadIdParams);
        setMessages(messages);
      } catch (error) {
        console.error('cannot fetch messages:', error);
        // TODO: implement retry button to refresh with UI error message
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [threadIdParams]);

  const createThread = async (): Promise<string> => {
    const res = await fetch(`/api/threads`, {
      method: "POST",
      body: JSON.stringify({
        title: userInput
      })
    });
    const data = await res.json();
    return data.threadId as string;
  };

  const handleChatError = () => {
    cancelRun();
    setHasIncomplete(true);
    setIsGenerating(false);
  };

  const sendMessage = async (text: string, threadId: string, messages: Message[]) => {
    if (hasIncomplete) setHasIncomplete(false);
    if (messages.length === 0 && threadId) {
      try {
        updateTitleForThread(threadId, userInput);
      } catch (error) {
        console.error("cannot update title for thread:", error);
      }
    }
    handleTextCreated();
    const stream = streamingFetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: text,
        isFormattingAssistant: false,
        messages: messages
      }),
    })
    let answer = "";
    let firstChunkReceived = false;
    for await (let chunk of stream) {
      if (!firstChunkReceived) {
        setIsStreaming(true);
        firstChunkReceived = true;
      }
      appendToLastMessage(chunk);
      answer = answer += chunk;
    }
    insertMessage("user", text, threadId);
    insertMessage("assistant", answer, threadId);
    setIsGenerating(false);
    setIsStreaming(false);
  };

  const handleOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) return;
    if (!userInput.trim()) return;
    setIsGenerating(true);
    let threadId = threadIdParams;
    if (!threadId && !threadIdState) {
      threadId = await createThread();
      setThreadIdState(threadId);
    }
    const newUserMessage: Message = {role: "user", text: userInput};
    const currentMessages: Message[] = [...messages, newUserMessage];
    setMessages((prevMessages) => [
      ...prevMessages,
      newUserMessage,
    ]);
    sendMessage(userInput, threadId ?? threadIdState, currentMessages);
    setUserInput("");
    scrollToBottom();
  }

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    appendMessage("assistant", "");
  };

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const appendToLastMessage = (text: string) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (!lastMessage) return prevMessages;
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role: MessageRole, text: string) => {
    setMessages((prevMessages) => [...prevMessages, {role, text}]);
  };

  const cancelRun = async () => {
    if (!threadIdState || !currentRunId) return;
    try {
      const response = await fetch(
        `/api/threads/${threadIdState}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            runId: currentRunId,
          }),
        }
      );
      if (!response.body || !response.ok) {
        console.error("Cannot cancel run:", response.status, response.statusText);
        return;
      }
      setIsGenerating(false);
    } catch (error) {
      console.error("cannot cancel run:", error);
    }
  }

  const retryMessage = () => {
    // Find the index of the last "user" message
    const messageIndex = messages.slice().reverse().findIndex((msg) => msg.role === "user");
    if (messageIndex === -1) {
      console.error("Cannot retry because there is no user message");
      return;
    }
    // Calculate the index of the last user message in the original array
    const lastIndex = messages.length - 1 - messageIndex;

    // Retain only the messages up to and including the last "user" message
    let updatedMessages = messages.slice(0, lastIndex + 1);

    // Remove any "assistant" messages that appear after the last "user" message
    updatedMessages = updatedMessages.filter((msg, index) => {
      return index <= lastIndex || msg.role !== "assistant";
    });
    setMessages(updatedMessages);

    const threadId = threadIdState ? threadIdState : threadIdParams;
    if (!threadId) {
      console.error("Cannot retry because there is no threadId");
      return;
    }
    // Send the message with the last "user" message's text
    sendMessage(updatedMessages[lastIndex].text, threadId, updatedMessages);
  };

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto">
      {messages.map((message, index) => {
        return (
          <div key={index}>
            <strong>{`${message.role}: `}</strong>
            <BotMessage
              content={message.text}
              isGenerating={isGenerating}
            />
            <br/>
            <br/>
          </div>
        );
      })}
      {(isGenerating && isStreaming) && (
        <div className="h-8 w-full max-w-md p-2 mb-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"/>
      )}
      {(isGenerating && !isStreaming) && (
        <ProgressChatBar />
      )}
      {loadingMessages && (
        <div className="flex justify-center items-center">
          <Spinner/>
        </div>
      )}
      {hasIncomplete && (
        <div className="mb-8">
          <IncompleteMessage onRetryClicked={retryMessage} />
        </div>
      )}
      <div ref={messagesEndRef}/>
      <div className="fixed bottom-0 pb-8 left-0 right-0 mx-auto flex flex-row items-center justify-center bg-background">
        <VoiceRecordButton
          isGenerating={isGenerating}
          onReceivedText={(text) => setUserInput(prevState => prevState ? `${prevState} ${text}`: text)}
        />
        <ChatInput
          onChange={(e) => setUserInput(e.target.value)}
          isGenerating={isGenerating}
          input={userInput}
          onSubmit={handleOnSubmit}
          onStopClicked={cancelRun}
        />
      </div>
    </div>
  );
}
