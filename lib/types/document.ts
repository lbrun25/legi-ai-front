export interface UserDocument {
  id: bigint;
  content: string;
  filename: string;
  index: number;
  metadata: string;
  embedding_openai: number[];
  embedding_voyage: number[];
}
