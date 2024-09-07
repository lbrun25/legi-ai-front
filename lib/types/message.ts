export interface Message {
  role: MessageRole;
  text: string;
  thread_id?: string;
}

export type MessageRole = "user" | "assistant";
