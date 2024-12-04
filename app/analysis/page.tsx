"use client";

import {redirect} from "next/navigation";
import {AnalysisQuestion, AnalysisQuestionAnswerType} from "@/lib/types/analysis";
import {Calendar, CheckCircle, FileText, Hash} from "lucide-react";
import {useAppState} from "@/lib/context/app-state";
import {useEffect, useRef, useState} from "react";
import {createChunksForFile, ingestChunks} from "@/lib/utils/documents";
import {streamingFetch} from "@/lib/utils/fetch";

const answerTypeIcons: Record<AnalysisQuestionAnswerType, JSX.Element> = {
  number: <Hash className="w-4 h-4 inline mr-2 text-blue-500"/>,
  date: <Calendar className="w-4 h-4 inline mr-2 text-green-500"/>,
  "yes/no": <CheckCircle className="w-4 h-4 inline mr-2 text-yellow-500"/>,
  text: <FileText className="w-4 h-4 inline mr-2 text-gray-500"/>,
};

export default function Page(
  {
    searchParams,
  }: {
    searchParams: { questions: string };
  }) {
  const { analysisFiles, chunkingMode } = useAppState();
  const [cellResults, setCellResults] = useState<Record<string, string>>({});

  if (!searchParams.questions) {
    redirect("/");
  }

  const parsedQuestions = searchParams.questions
    ? JSON.parse(searchParams.questions)
    : [];

  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) {
      return;
    }
    hasExecuted.current = true;
    console.log('processDocuments');
    const processDocuments = async () => {
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
      // Process all files in parallel
      const filePromises = analysisFiles.map(async (file, fileIndex) => {
        console.log('process file:', file.name);
        const chunks = await createChunksForFile(file, chunkingMode);
        await ingestChunks(chunks, file.name, (chunkIndex) => {});
        const questionPromises = parsedQuestions.map(async (question: AnalysisQuestion) => {
          console.log('process question:', question);
          analyseDocument(file, question, (result) => {
            updateCellResult(file.name, question.content, result);
          });
        });
        await Promise.all(questionPromises);
      });
      // Wait for all files to finish processing
      await Promise.all(filePromises);
    }
    processDocuments();
  }, []);

  const updateCellResult = (fileName: string, questionContent: string, result: string) => {
    const key = `${fileName}-${questionContent}`;
    setCellResults((prev) => ({
      ...prev,
      [key]: result,
    }));
  };


  const analyseDocument = async (file: File, question: AnalysisQuestion, setCellResult: (result: string) => void) => {
    const { signal } = new AbortController();

    let answer = "";
    let firstChunkReceived = false;

    try {
      const stream = streamingFetch('/api/assistant/files/analysis', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          question: question,
        }),
        signal
      });

      for await (let chunk of stream) {
        if (!firstChunkReceived) {
          // setIsStreaming(true);
          firstChunkReceived = true;
        }
        answer += chunk;
      }
      setCellResult(answer);
    } catch (error) {
      console.error("Error streaming result:", error);
      setCellResult("Erreur d'analyse");
    }
  }

  return (
    <div className="flex flex-col max-w-[1000px] pb-80 pt-40 mx-auto gap-8">
      <h1 className="text-3xl font-bold text-gray-800">Résultats de l'analyse</h1>
      <div className="overflow-hidden shadow-lg">
        <table className="table-auto w-full border-collapse bg-white rounded-lg">
          <thead className="bg-gray-100">
          <tr>
            <th
              className="border border-gray-300 px-3 py-2 text-center text-gray-600 text-sm font-semibold"
            >
              #
            </th>
            <th
              className="border border-gray-300 px-4 py-2 text-left text-gray-600 text-sm font-semibold"
            >
              {"Fichier"}
            </th>
            {parsedQuestions.map((question: any, index: number) => (
              <th
                key={index}
                className="border border-gray-300 px-4 py-2 text-left text-gray-600 text-sm font-semibold"
              >
                <div className="flex flex-row items-center">
                  {answerTypeIcons[question.answerType as AnalysisQuestionAnswerType]}
                  {question.content || `Question ${index + 1}`}
                </div>
              </th>
            ))}
          </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
          {analysisFiles.map((file: File) => (
            <tr
              key={file.name}
              className={`hover:bg-gray-50 ${
                analysisFiles.indexOf(file) % 2 === 0 ? "bg-gray-50" : "bg-white"
              }`}
            >
              <td className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-700 w-[60px] max-w-[60px]">
                {analysisFiles.indexOf(file) + 1}
              </td>
              <td
                className="border overflow-hidden whitespace-nowrap text-ellipsis border-gray-300 px-4 py-2 text-sm text-gray-700 truncate w-[350px] max-w-[350px]"
                title={file.name} // Add title to show full file name on hover
              >
                {file.name}
              </td>
              {parsedQuestions.map((question: AnalysisQuestion, questionIndex: number) => (
                <td
                  key={`${file.name}-${question.content}`}
                  className="border border-gray-300 px-4 py-2 text-sm text-gray-700"
                >
                  {cellResults[`${file.name}-${question.content}`] ? (
                    cellResults[`${file.name}-${question.content}`]
                  ) : (
                    <div className="h-8 w-full max-w-md bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"/>
                  )}
                </td>
              ))}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
