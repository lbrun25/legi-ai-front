"use server"
import {createClient} from "@/lib/supabase/client/server";
import {Thread} from "@/lib/types/thread";

export async function insertThread(thread: Thread): Promise<Thread | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('threads')
    .insert([thread])
    .single();
  if (error) {
    console.error('Error inserting thread:', error);
    return null;
  }
  return data;
}

export async function getThreads(): Promise<Thread[]> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error("Error retrieving threads:", error);
    throw error;
  }
  return data;
}

export async function getLatestThread(userId: string): Promise<Thread> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Error retrieving latest thread:', error);
    throw error;
  }
  return data[0];
}

export async function getThread(threadId: string): Promise<Thread | null> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .eq('thread_id', threadId)
    .single();
  if (error) {
    return null;
  }
  return data;
}

export async function updateTitleForThread(threadId: string, title: string) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from('threads')
    .update({title})
    .eq('thread_id', threadId)
    .single();
  if (error) {
    throw error;
  }
}

export async function deleteThreads() {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from('threads')
    .delete()
    .eq('user_id', authData.user.id)
  if (error) {
    console.error("Error retrieving threads:", error);
    throw error;
  }
  return data;
}
