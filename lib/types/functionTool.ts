export interface FunctionToolParametersProperty {
  type: string;
  description: string;
}

export interface GetMatchedArticlesToolParametersProperties {
  query: FunctionToolParametersProperty;
}

export interface GetMatchedDecisionsToolParametersProperties {
  query: FunctionToolParametersProperty;
}

export interface GetMatchedDoctrinesToolParametersProperties {
  query: FunctionToolParametersProperty;
}

export interface GetArticleByNumberToolParametersProperties {
  source: FunctionToolParametersProperty;
  number: FunctionToolParametersProperty;
}
