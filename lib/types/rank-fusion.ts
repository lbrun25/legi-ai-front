export interface ScoredRankFusionItem  {
  id: bigint;
  score: number;
  fromSemantic: boolean;
  fromBM25: boolean;
}

export interface RankFusionResult {
  results: ScoredRankFusionItem[];
  semanticCount: number;
  bm25Count: number;
}
