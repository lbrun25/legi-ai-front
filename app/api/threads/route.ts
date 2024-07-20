import {createClient} from "@/lib/supabase/client/server";
import OpenAI from "openai";
import {insertThread} from "@/lib/supabase/threads";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const {data: authData, error: authError} = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(null, {status: 403});
    }
    const {data, error} = await supabase
      .from('threads')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', {ascending: false});

    if (error) {
      console.error('Error retrieving threads:', error);
      return new Response(null, {status: 500})
    }
    return new Response(JSON.stringify(data), {status: 200})
  } catch (error) {
    return new Response(null, {status: 500})
  }
}

// Create a new thread
export async function POST(req: Request) {
  const input: {
    title: string;
  } = await req.json();
  const thread = await openai.beta.threads.create();
  const supabase = createClient();
  const {data: authData, error: authError} = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return new Response(null, {status: 403});
  }
  await insertThread({
      thread_id: thread.id,
      user_id: authData.user.id,
      title: input.title
    }
  );
  return Response.json({threadId: thread.id});
}
