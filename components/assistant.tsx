"use client"
import {BotMessage} from "@/components/message";
import {ChatInput} from "@/components/chat-input";
import React, {FormEvent, useEffect, useRef, useState} from "react";
import {Message} from "@/lib/types/message";
import {getThread, updateTitleForThread} from "@/lib/supabase/threads";
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
import {Suggestions} from "@/components/suggestions";
import {AnswerSuggestions} from "@/components/answer-suggestions";
import {ToolName} from "@/lib/types/functionTool";
import {VoteButtons} from "@/components/vote-buttons";
import {UploadFilesButton} from "@/components/upload-files-button";
import UploadedFilesList from "@/components/uploaded-files-list";
import {toast} from "sonner";
import {SelectMode} from "@/components/select-mode";
import {google} from "@google-cloud/documentai/build/protos/protos";
import IDocument = google.cloud.documentai.v1.IDocument;
import {PDFDocument} from "pdf-lib";
import {UnstructuredTableElement} from "@/lib/types/table";

interface AssistantProps {
  threadId?: string;
  messages?: Message[];
}

export const Assistant = ({threadId: threadIdParams}: AssistantProps) => {
  const {
    isGenerating,
    setIsGenerating,
    isStreaming,
    setIsStreaming,
    setTimeSaved,
    selectedMode,
    chunkingMode,
  } = useAppState();
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadIdState, setThreadIdState] = useState("");
  const [hasIncomplete, setHasIncomplete] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [welcomingSuggestionsHasClicked, setWelcomingSuggestionsHasClicked] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [filesUploading, setFilesUploading] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [fileProgress, setFileProgress] = useState<Record<string, { uploaded: number; total: number }>>({});

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
    const fetchTimeSaved = async () => {
      try {
        const existingThread = await getThread(threadIdParams);
        console.log('existingThread:', existingThread);
        const existingTimeSaved = existingThread?.time_saved;
        setTimeSaved(existingTimeSaved || 0);
        console.log('existingTimeSaved:', existingTimeSaved);
      } catch (error) {
        console.error("cannot get thread:", error);
      }
    }
    fetchTimeSaved();
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

  const updateTimeSaved = async (threadId: string, toolsCalled: ToolName[]) => {
    console.log('updateTimeSaved toolsCalled:', toolsCalled)
    console.log('threadIdState ?? threadIdParams:', threadIdState ?? threadIdParams)
    const res = await fetch(`/api/threads/${threadId}/timeSaved`, {
      method: "POST",
      body: JSON.stringify({
        toolsCalled: toolsCalled
      })
    });
    const data = await res.json();
    console.log('updateTimeSaved data:', data);
    setTimeSaved(data.timeSaved);
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
          messages: messages,
          fileIds,
          selectedMode
        }),
        signal
      });

      for await (let chunk of stream) {
        if (!firstChunkReceived) {
          setIsStreaming(true);
          firstChunkReceived = true;
        }
        if (chunk.includes("Tools called:")) {
          const toolsCalled = chunk.split(',');
          updateTimeSaved(threadId, toolsCalled as ToolName[]);
        } else {
          // Append normal content chunks to the answer
          appendToLastMessage(chunk);
          answer += chunk;
        }
      }
      insertMessage("user", text, threadId);
      const insertedAssistantMessage = await insertMessage("assistant", answer, threadId);
      // Update the id of the last assistant message
      if (insertedAssistantMessage) {
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          if (updatedMessages.length > 0) {
            const lastIndex = updatedMessages.length - 1;
            if (updatedMessages[lastIndex].role === "assistant") {
              updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                id: insertedAssistantMessage.id,
              };
            }
          }
          return updatedMessages;
        });
      }
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

  const enterInput = async (input: string) => {
    const newUserMessage: Message = {role: "user", text: input};
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
    sendMessage(input, threadId ?? threadIdState, currentMessages);
    setUserInput("");
    scrollToBottom();
  }

  const handleOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) return;
    // empty or contains only whitespace
    if (!userInput.trim()) return;
    setWelcomingSuggestionsHasClicked(false);
    await enterInput(userInput);
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

  const onWelcomingSuggestionsClicked = (text: string) => {
    setWelcomingSuggestionsHasClicked(true);
    enterInput(text);
  }

  const handleDeleteFile = (fileToDelete: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

  const handleFileUpload = async (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setFilesUploading(true);
    const uploadedFileIds: string[] = [];

    if (selectedFiles.length > 0) {
      try {
        await fetch('/api/assistant/files/checkTables', {
          method: 'POST',
        });
      } catch (error) {
        console.error("cannot check tables:", error);
      }
      try {
        await fetch('/api/assistant/files/deleteAll', {
          method: 'DELETE',
        });
      } catch (error) {
        console.error("cannot delete user documents:", error);
      }
    }

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        if (selectedMode === "synthesis") {
          const response = await fetch('/api/assistant/files/upload', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          console.log('result upload:', result);

          if (response.ok) {
            uploadedFileIds.push(result.fileId);
          } else {
            toast.error(`Erreur lors du téléchargement de "${file.name}": ${result.message}`);
          }
          continue;
        }

        // PDF splitting
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const totalPages = pdfDoc.getPageCount();
        const maxPages = 15;

        const splitTasks = Array.from({ length: Math.ceil(totalPages / maxPages) }, (_, index) => {
          const startPage = index * maxPages;
          const endPage = Math.min((index + 1) * maxPages, totalPages);

          return async () => {
            const subPdf = await PDFDocument.create();
            const pages = await subPdf.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, j) => startPage + j));
            pages.forEach((page) => subPdf.addPage(page));

            const chunkBuffer = await subPdf.save();
            return Buffer.from(chunkBuffer).toString('base64');
          };
        });
        const allEncodedDocument = await Promise.all(splitTasks.map((task) => task()));

        const documents = await Promise.all(
          allEncodedDocument.map(async (encodedFileContent: string) => {
            const ocrResponse = await fetch('/api/assistant/files/ocr', {
              method: 'POST',
              body: JSON.stringify({
                encodedFileContent,
              }),
            });
            const ocrResult = await ocrResponse.json();
            return ocrResult.document;
          })
        );

        const chunksResponses = await Promise.all(
          documents.map(async (doc: IDocument) => {
            const { text: documentText } = doc;
            if (!documentText)
              throw Error(`Could not find text in document`);
            const chunksResponse = await fetch('/api/assistant/files/chunks', {
              method: 'POST',
              body: JSON.stringify({
                documentText,
                chunkingMode
              }),
            });
            const chunksResult = await chunksResponse.json();
            return chunksResult.chunks;
          })
        );

        const chunks = chunksResponses.flat();
        const totalChunks = chunks.length;

        try {
          // Table chunks with Unstructured. Chunking by row by adding table headers and contextual.
          const unstructuredResponse = await fetch('/api/assistant/files/unstructured/partition', {
            method: 'POST',
            body: formData,
          });
          const unstructuredResponseResult = await unstructuredResponse.json();
          const unstructuredTables: UnstructuredTableElement[] = unstructuredResponseResult.tables;

          const tableChunksResponses = await Promise.all(
            unstructuredTables.map(async (unstructuredTable) => {
              try {
                const tableChunksResponse = await fetch('/api/assistant/files/chunks/table', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    table: unstructuredTable,
                  }),
                });
                const tableChunksResult = await tableChunksResponse.json();
                return tableChunksResult.chunks;
              } catch (error) {
                console.error("cannot make chunks for table:", error);
              }
            })
          );
          const tableChunks = tableChunksResponses.flat();
          chunks.push(...tableChunks);
        } catch (error) {
          console.error("cannot make chunks for table:", error);
        }

        setFileProgress((prev) => ({
          ...prev,
          [file.name]: { uploaded: 0, total: totalChunks }, // Track chunks directly
        }));

        // Process all chunks in parallel
        await Promise.all(
          chunks.map(async (chunk: string, chunkIndex: number) => {
            try {
              // Send chunk to the server
              const ingestResponse = await fetch('/api/assistant/files/ingest', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chunk: chunk,
                  filename: file.name,
                  index: chunkIndex, // Use chunk index directly
                }),
              });

              if (!ingestResponse.ok) {
                console.error(`Failed to ingest chunk at index ${chunkIndex}:`, chunk);
              }

              // Update progress after processing this chunk
              setFileProgress((prev) => ({
                ...prev,
                [file.name]: {
                  ...prev[file.name],
                  uploaded: (prev[file.name]?.uploaded || 0) + 1, // Increment uploaded count
                },
              }));
            } catch (error) {
              console.error(`Error ingesting chunk at index ${chunkIndex}:`, error);
            }
          })
        );
      } catch (error) {
        console.error(`cannot upload file ${file.name}:`, error);
        toast.error(`Échec du téléchargement de "${file.name}".`);
      }
    }

    setFileIds(uploadedFileIds);
    setFilesUploading(false);
  };

  return (
    <div className="flex flex-col w-full max-w-[850px] pb-80 pt-40 mx-auto gap-8">
      {messages.map((message, index) => {
        const threadId = message.thread_id ?? threadIdState ?? threadIdParams;
        return (
          <div key={message.id} className={cn("px-8 py-6", message.role === "assistant" ? "rounded-3xl bg-gray-50 dark:bg-gray-900 shadow" : "")}>
            {message.role === "assistant" && <AssistantRoleMessage/>}
            {message.role === "user" && <UserRoleMessage/>}
            <div className="mt-4 ml-8">
              <BotMessage
                content={message.text}
                isGenerating={isGenerating}
              />
              {index === messages.length - 1 && (
                <div className="mt-8">
                  {(isGenerating && !isStreaming) && (
                    <div className="mb-8">
                      <ProgressChatBar />
                    </div>
                  )}
                  {(isGenerating && isStreaming) && (
                    <div className="h-8 w-full max-w-md p-2 mb-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"/>
                  )}
                  {hasIncomplete && (
                    <div className="mb-8">
                      <IncompleteMessage onRetryClicked={retryMessage} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {(message.role === "assistant" && messages.length > 1 && (index !== messages.length - 1 || !isGenerating) && message.text !== WelcomingAssistantMessage) && (
              <div className="mt-4 flex flex-row justify-between">
                <div className="flex flex-row">
                  {(message.id && threadId) &&
                    <VoteButtons messageId={message.id} threadId={threadId} />
                  }
                </div>
                <div>
                  <CopyButton contentToCopy={message.text}/>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {messages.length < 2 && (
        <Suggestions onSuggestionClicked={onWelcomingSuggestionsClicked}/>
      )}
      {loadingMessages && (
        <div className="flex justify-center items-center">
          <Spinner/>
        </div>
      )}
      {(messages.length > 1 && !welcomingSuggestionsHasClicked && !isGenerating) && (
        <div className="mt-8 mx-auto">
          <AnswerSuggestions
            answer={messages[messages.length - 1].text}
            isGenerating={isGenerating}
            onSuggestionClicked={(text) => enterInput(text)}
          />
        </div>
      )}
      <div ref={messagesEndRef}/>
      <div
        className="fixed bottom-0 pb-8 left-0 right-0 mx-auto flex flex-col items-center justify-center bg-background">
        <div className="flex flex-row items-center justify-center w-full">
          <div className="max-w-4xl w-full px-4 space-y-6">
            {(files.length > 0 && (selectedMode === "analysis" || selectedMode === "synthesis")) && (
              <UploadedFilesList
                files={files}
                onDeleteFile={handleDeleteFile}
                uploading={filesUploading}
                progress={fileProgress}
              />
            )}
            <SelectMode />
            <div className="flex flex-row items-center space-x-4">
              <div className="flex flex-row space-x-4">
                <div className="flex flex-row space-x-4 items-center flex-shrink-0">
                  <VoiceRecordButton
                    isGenerating={isGenerating}
                    onReceivedText={(text) => setUserInput(prevState => prevState ? `${prevState} ${text}` : text)}
                  />
                  {(selectedMode === "analysis" || selectedMode === "synthesis") && (
                    <UploadFilesButton
                      isGenerating={isGenerating}
                      onAcceptedFiles={handleFileUpload}
                    />
                  )}
                </div>
              </div>
              <div className="flex-grow">
                <ChatInput
                  onChange={(e) => setUserInput(e.target.value)}
                  isGenerating={isGenerating}
                  input={userInput}
                  onSubmit={handleOnSubmit}
                  onStopClicked={stopStreaming}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-[-20px] mt-2">
          {"Vos données sont sécurisées et restent confidentielles. Attention, Mike peut faire des erreurs."}
        </div>
      </div>
    </div>
  );
}
