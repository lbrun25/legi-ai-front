export interface CollectiveAgreementDocument {
  id: bigint;
  content: string;
  legal_state: string;
  url: string;
  collective_agreement: string;
  embedding_voyage: number[];
}
