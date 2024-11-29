export type AnalysisQuestionAnswerType = "number" | "date" | "yes/no" | "text";

export interface AnalysisQuestion {
  content: string;
  answerType: AnalysisQuestionAnswerType;
}
