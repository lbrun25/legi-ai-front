"use client"
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
import {AssistantRoleMessage} from "@/components/assistant-role-message";
import {UserRoleMessage} from "@/components/user-role-message";
import {CopyButton} from "@/components/copy-button";
import {useAppState} from "@/lib/context/app-state";
import {WelcomingAssistantMessage} from "@/lib/constants/assistant";
import {cn} from "@/lib/utils";

interface AssistantProps {
  threadId?: string;
  messages?: Message[];
}

export const Assistant = ({threadId: threadIdParams}: AssistantProps) => {
  const {isGenerating, setIsGenerating, isStreaming, setIsStreaming} = useAppState();
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadIdState, setThreadIdState] = useState("");
  const [hasIncomplete, setHasIncomplete] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  };
  useEffect(() => {
    scrollToBottom();
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          text: WelcomingAssistantMessage
        }
      ])
    }
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
    stopStreaming();
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

    if (abortControllerRef.current)
      abortControllerRef.current.abort("Cancel any ongoing streaming request"); // Cancel any ongoing request before starting a new one

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    let answer = "";
    let firstChunkReceived = false;

    try {
      const stream = streamingFetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: text,
          isFormattingAssistant: false,
          messages: messages
        }),
        signal
      });

      for await (let chunk of stream) {
        if (!firstChunkReceived) {
          setIsStreaming(true);
          firstChunkReceived = true;
        }
        appendToLastMessage(chunk);
        answer += chunk;
      }
      insertMessage("user", text, threadId);
      insertMessage("assistant", answer, threadId);
    } catch (error) {
      if (error === "User stopped the streaming") {
        console.log("Streaming request was aborted");
        insertMessage("user", text, threadId);
      } else {
        console.error("Streaming error:", error);
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  };

  const handleOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) return;
    if (!userInput.trim()) return;
    const newUserMessage: Message = {role: "user", text: userInput};
    const currentMessages: Message[] = [...messages, newUserMessage];
    setMessages((prevMessages) => [
      ...prevMessages,
      newUserMessage,
      {role: "assistant", text: ""}
    ]);
    setIsGenerating(true);
    let threadId = threadIdParams;
    if (!threadId && !threadIdState) {
      threadId = await createThread();
      setThreadIdState(threadId);
    }
    sendMessage(userInput, threadId ?? threadIdState, currentMessages);
    setUserInput("");
    scrollToBottom();
  }

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

  const stopStreaming = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("User stopped the streaming"); // Call abort on the AbortController to cancel the request
      setIsStreaming(false);
      setIsGenerating(false);
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
    setIsGenerating(true);
    // Send the message with the last "user" message's text
    sendMessage(updatedMessages[lastIndex].text, threadId, updatedMessages);
  };

  return (
    <div className="flex flex-col w-full max-w-screen-sm pb-24 pt-40 mx-auto gap-8">
      {messages.map((message, index) => {
        return (
          <div key={index} className={cn("p-4 pl-16", message.role === "assistant" ? "rounded-3xl bg-gray-50" : "")}>
            {message.role === "assistant" && <AssistantRoleMessage/>}
            {message.role === "user" && <UserRoleMessage/>}
            <div className="mt-4">
              <BotMessage
                content={message.text}
                isGenerating={isGenerating}
              />
            </div>
            {(message.role === "assistant" && messages.length > 1 && (index !== messages.length - 1 || !isGenerating) && message.text !== WelcomingAssistantMessage) && (
              <div className="mt-2 justify-end flex flex-row">
                <CopyButton contentToCopy={message.text}/>
              </div>
            )}
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
      <div className="fixed bottom-0 pb-8 left-0 right-0 mx-auto flex flex-col items-center justify-center bg-background">
        <div className="flex flex-row items-center justify-center w-full">
          <VoiceRecordButton
            isGenerating={isGenerating}
            onReceivedText={(text) => setUserInput(prevState => prevState ? `${prevState} ${text}`: text)}
          />
          <ChatInput
            onChange={(e) => setUserInput(e.target.value)}
            isGenerating={isGenerating}
            input={userInput}
            onSubmit={handleOnSubmit}
            onStopClicked={stopStreaming}
          />
        </div>
        <div className="text-xs text-gray-500 mb-[-20px] mt-2">
          {"Vos données sont sécurisées et restent confidentielles. Attention, Mike peut faire des erreurs."}
        </div>
      </div>
    </div>
  );
}
