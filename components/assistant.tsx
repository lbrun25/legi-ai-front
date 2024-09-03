import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import {OpenAI} from "openai";
import React, {FormEvent, useEffect, useRef, useState} from "react";
import {AssistantStream} from "openai/lib/AssistantStream";
import {ChatCompletionMessageToolCall} from "ai/prompts";
import {getMatchedArticlesToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedArticlesToolOutput";
import {getMatchedDecisionsToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedDecisionsToolOutput";
import {getMatchedDoctrinesToolOutput} from "@/lib/ai/openai/assistant/tools/getMatchedDoctrinesToolOutput";
import {RunSubmitToolOutputsParams} from "openai/resources/beta/threads/runs/runs";
import {AnnotationDelta} from "openai/resources/beta/threads/messages";
import {AssistantStreamEvent} from "openai/resources/beta/assistants";
import {Message} from "@/lib/types/message";
import {updateTitleForThread} from "@/lib/supabase/threads";
import {Spinner} from "@/components/ui/spinner";
import {getArticleByNumberToolOutput} from "@/lib/ai/openai/assistant/tools/getArticleByNumberToolOutput";
import {IncompleteMessage} from "@/components/incomplete-message";
import {VoiceRecordButton} from "@/components/voice-record-button";
import {ProgressChatBar} from "@/components/progress-chat-bar";
import {formatResponseToolOutput} from "@/lib/ai/openai/assistant/tools/formatResponseToolOutput";

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
        const response = await fetch(`/api/threads/${threadIdParams}/messages`);
        if (!response.ok) {
          return;
        }
        const data: OpenAI.Beta.Threads.Message[] = await response.json();
        const userMessages = data
          .filter(openaiMessage => openaiMessage.assistant_id === null)
          .filter((_, index) => index % 2 !== 0);
        const assistantMessages = data.filter(openaiMessage => openaiMessage.assistant_id === process.env.NEXT_PUBLIC_FORMATTING_ASSISTANT_ID);
        const filteredMessages = userMessages.concat(assistantMessages).sort((a, b) => a.created_at - b.created_at);
        const messages: Message[] = filteredMessages.map(openaiMessage => {
          const text = openaiMessage.content
            .filter(content => content.type === "text")
            .map(content => content.text.value)
            .join(" ");
          return {
            role: openaiMessage.role,
            text: text
          };
        });
        setMessages(messages);
      } catch (error) {
        console.error('cannot fetch messages:', error);
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

  const sendMessage = async (text: string, threadId: string) => {
    if (hasIncomplete) setHasIncomplete(false);
    if (messages.length === 0 && threadId) {
      try {
        updateTitleForThread(threadId, userInput);
      } catch (error) {
        console.error("cannot update title for thread:", error);
      }
    }
    const response = await fetch(
      `/api/threads/${threadId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: text,
          isFormattingAssistant: false
        }),
      }
    );
    if (!response.body || !response.ok) {
      console.error("Cannot send message:", response.status, response.statusText);
      handleChatError();
      return;
    }
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream, threadId);
  };

  const handleOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userInput.trim()) return;
    setIsGenerating(true);
    let threadId = threadIdParams;
    if (!threadId && !threadIdState) {
      threadId = await createThread();
      setThreadIdState(threadId);
    }
    sendMessage(userInput, threadId ?? threadIdState);
    setMessages((prevMessages) => [
      ...prevMessages,
      {role: "user", text: userInput},
    ]);
    setUserInput("");
    scrollToBottom();
  }

  const submitActionResult = async (
    runId: string,
    toolCallOutputs: Array<RunSubmitToolOutputsParams.ToolOutput>,
    threadId: string
  ) => {
    try {
      const response = await fetch(
        `/api/threads/${threadId}/tools`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            runId: runId,
            toolCallOutputs: toolCallOutputs,
          }),
        }
      );
      if (!response.ok || !response.body) {
        console.error("Cannot submit tools:", response.status, response.statusText);
        handleChatError();
        return;
      }
      const stream = AssistantStream.fromReadableStream(response.body);
      handleReadableStream(stream, threadId);
    } catch (error) {
      console.error("Cannot submit tools:", error);
      handleChatError();
    }
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    if (!isStreaming)
      setIsStreaming(true);
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta: OpenAI.Beta.Threads.Messages.TextDelta) => {
    if (delta.value != null) {
      appendToLastMessage(delta.value);
    }
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
  };

  // toolCallCreated - log new tool call
  const toolCallCreated = (toolCall: OpenAI.Beta.Threads.Runs.Steps.ToolCall) => {
    if (toolCall.type != "code_interpreter") return;
    appendMessage("code", "");
  };

  // toolCallDelta - log delta and snapshot for the tool call
  const toolCallDelta = (delta: OpenAI.Beta.Threads.Runs.Steps.ToolCallDelta) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter?.input) return;
    appendToLastMessage(delta.code_interpreter.input);
  };

  // handleRequiresAction - handle function call
  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction,
    threadId: string
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action?.submit_tool_outputs.tool_calls;
    if (!toolCalls) {
      console.error("Cannot handle requires action: tool calls are undefined");
      handleChatError();
      return;
    }
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall: ChatCompletionMessageToolCall) => {
        const params = toolCall.function.arguments;
        if (toolCall.function.name === "getMatchedArticles") {
          const articlesTool = await getMatchedArticlesToolOutput(params, toolCall);
          if (articlesTool.hasTimedOut)
            handleChatError();
          return articlesTool.toolOutput;
        }
        if (toolCall.function.name === "getMatchedDecisions") {
          const decisionsTool = await getMatchedDecisionsToolOutput(params, toolCall);
          if (decisionsTool.hasTimedOut)
            handleChatError();
          return decisionsTool.toolOutput;
        }
        if (toolCall.function.name === "getMatchedDoctrines") {
          const doctrinesTool = await getMatchedDoctrinesToolOutput(params, toolCall);
          if (doctrinesTool.hasTimedOut)
            handleChatError();
          return doctrinesTool.toolOutput;
        }
        if (toolCall.function.name === "getArticleByNumber") {
          return getArticleByNumberToolOutput(params, toolCall);
        }
        if (toolCall.function.name === "formatResponse")
          return formatResponseToolOutput(toolCall);
      })
    );
    const filteredToolOutputs = toolCallOutputs.filter(item => !!item);
    submitActionResult(runId, filteredToolOutputs, threadId);
  };

  const handleReadableStream = (stream: AssistantStream, threadId: string) => {
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);

    let lastMessage: string;
    // messages
    stream.on("messageDone", (async message => {
      lastMessage = message.content.map((m => m.type === "text" ? m.text.value : "")).join("");
    }))

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", async (event) => {
      if (event.event === "thread.run.created") {
        setCurrentRunId(event.data.id);
      }
      if (event.event === "thread.run.completed") {
        setIsGenerating(false);
        setIsStreaming(false);
      }
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event, threadId);
      if (event.event === "thread.message.incomplete")
        console.log("incomplete message:", event.data);
    });
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

  const appendMessage = (role: string, text: string) => {
    setMessages((prevMessages) => [...prevMessages, {role, text}]);
  };

  const annotateLastMessage = (annotations: Array<AnnotationDelta>) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (!lastMessage) return prevMessages;
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation: AnnotationDelta) => {
        if (annotation.type === 'file_path' && annotation?.text && annotation?.file_path?.file_id) {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`
          );
        }
      })
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  }

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
    sendMessage(updatedMessages[lastIndex].text, threadId);
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
