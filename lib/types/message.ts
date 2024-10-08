export interface Message {
  id?: bigint;
  role: MessageRole;
  text: string;
  thread_id?: string;
  created_at?: Date;
}

export type MessageRole = "user" | "assistant";
