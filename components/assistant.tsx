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

  const sendMessage = async (text: string, threadId: string) => {
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
        return;
      }
      const stream = AssistantStream.fromReadableStream(response.body);
      handleReadableStream(stream, threadId);
    } catch (error) {
      console.error("Cannot submit tools:", error);
    }
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextFormattingCreated = () => {
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextFormattingDelta = (delta: OpenAI.Beta.Threads.Messages.TextDelta) => {
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
      return;
    }
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall: ChatCompletionMessageToolCall) => {
        const params = toolCall.function.arguments;
        if (toolCall.function.name === "getMatchedArticles")
          return getMatchedArticlesToolOutput(params, toolCall);
        if (toolCall.function.name === "getMatchedDecisions")
          return getMatchedDecisionsToolOutput(params, toolCall);
        if (toolCall.function.name === "getMatchedDoctrines")
          return getMatchedDoctrinesToolOutput(params, toolCall);
        if (toolCall.function.name === "getArticleByNumber")
          return getArticleByNumberToolOutput(params, toolCall);
      })
    );
    const filteredToolOutputs = toolCallOutputs.filter(item => !!item);
    submitActionResult(runId, filteredToolOutputs, threadId);
  };

  const handleFormattingReadableStream = (stream: AssistantStream, threadId: string) => {
    stream.on("textCreated", handleTextFormattingCreated);
    stream.on("textDelta", handleTextFormattingDelta);
    stream.on("event", (event) => {
      if (event.event === "thread.run.completed") setIsGenerating(false);
    });
  }

  const handleReadableStream = (stream: AssistantStream, threadId: string) => {
    // messages
    stream.on("messageDone", (async message => {
      const lastMessage = message.content.map((m => m.type === "text" ? m.text.value : "")).join("");
      const response = await fetch(
        `/api/threads/${threadId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: lastMessage,
            isFormattingAssistant: true
          }),
        }
      );
      if (!response.body || !response.ok) {
        console.error("Cannot send formatting message:", response.status, response.statusText);
        return;
      }
      const stream = AssistantStream.fromReadableStream(response.body);
      handleFormattingReadableStream(stream, threadId);
    }))

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
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
      {isGenerating && (
        <div className="h-8 w-full max-w-md p-2 mb-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"/>
      )}
      {loadingMessages && (
        <div className="flex justify-center items-center">
          <Spinner/>
        </div>
      )}
      <div ref={messagesEndRef}/>
      <div
        className="fixed bottom-0 pb-8 left-0 right-0 mx-auto flex flex-col items-center justify-center bg-background">
        <ChatInput
          onChange={(e) => setUserInput(e.target.value)}
          isGenerating={isGenerating}
          input={userInput}
          onSubmit={handleOnSubmit}
          onStopClicked={() => {
          }}
        />
      </div>
    </div>
  );
}
