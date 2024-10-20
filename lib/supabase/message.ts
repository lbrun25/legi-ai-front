"use server"
import {createClient} from "@/lib/supabase/client/server";
import {Message} from "@/lib/types/message";

export async function insertMessage(role: string, text: string, threadId: string): Promise<Message | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert([{role, text, thread_id: threadId}])
    .select()
    .single();
  if (error) {
    console.error('Error inserting message:', error);
    return null;
  }
  return data;
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error("Error retrieving messages:", error);
    throw error;
  }
  return data;
}

export async function deleteMessages(threadId: string) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('thread_id', threadId)
  if (error) {
    console.error("Error deleting messages:", error);
    throw error;
  }
  return data;
}
