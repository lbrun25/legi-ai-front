import {Input} from "@/components/ui/input";
import * as React from "react";
import Select from 'react-select'
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {PlusIcon} from "lucide-react";
import {AnalysisQuestion, AnalysisQuestionAnswerType} from "@/lib/types/analysis";

interface AnalysisQuestionListProps {
  questions: AnalysisQuestion[];
  onQuestionsChange: (updatedQuestions: AnalysisQuestion[]) => void;
}

// Map the labels for the AnalysisQuestionAnswerType
const answerTypeOptions = [
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "yes/no", label: "Oui/Non" },
  { value: "text", label: "Texte" },
];

export const AnalysisQuestionList = ({questions, onQuestionsChange}: AnalysisQuestionListProps) => {
  const handleContentChange = (index: number, newContent: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].content = newContent;
    onQuestionsChange(updatedQuestions);
  };

  const handleAnswerTypeChange = (index: number, newAnswerType: AnalysisQuestionAnswerType) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].answerType = newAnswerType;
    onQuestionsChange(updatedQuestions);
  };

  const handleAddQuestion = () => {
    const updatedQuestions = [
      ...questions,
      { content: "", answerType: "text" as AnalysisQuestionAnswerType },
    ];
    onQuestionsChange(updatedQuestions);
  };

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question, index) => (
        <div key={index} className="flex justify-center space-x-4 items-center">
          {/* Input field for question content */}
          <Input
            type="text"
            value={question.content}
            onChange={(e) => handleContentChange(index, e.target.value)}
            placeholder="Votre question"
            className="pr-14 h-12"
          />
          {/* Dropdown for answer type */}
          <Select
            className="min-w-32"
            options={answerTypeOptions}
            value={answerTypeOptions.find(option => option.value === question.answerType)}
            onChange={(selectedOption) => handleAnswerTypeChange(index, selectedOption!.value as AnalysisQuestionAnswerType)}
            placeholder="Sélectionner le type de réponse"
          />
        </div>
      ))}
      <Button
        size={'icon'}
        variant={'secondary'}
        className={cn(
          'h-12 w-12 rounded-full resize-none',
        )}
        onClick={handleAddQuestion}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
