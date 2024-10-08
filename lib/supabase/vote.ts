import {createClient} from "@/lib/supabase/client/browser";

export const insertVote = async (threadId: string, messageId: bigint, comment: string, isUp: boolean) => {
  const supabase = createClient();
  const {data: authData, error: authError} = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    console.error("Supabase auth error:", authError);
    throw authError;
  }
  const {data, error} = await supabase
    .from('votes')
    .insert([{
      thread_id: threadId,
      message_id: messageId,
      comment,
      is_up: isUp,
      user_id: authData.user.id
    }])
    .single();
  if (error) {
    console.error('Error inserting vote:', error);
    throw error;
  }
  return data;
}
