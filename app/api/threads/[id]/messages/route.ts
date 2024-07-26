import {z} from "zod";
import {createClient} from "@/lib/supabase/client/server";
import {Thread} from "@/lib/types/thread";
import OpenAI from "openai";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const supabase = createClient()
    const {params} = routeContextSchema.parse(context)
    const {data, error} = await supabase
      .from("threads")
      .select("*")
      .eq('thread_id', params.id)
      .single();
    if (error) {
      return new Response(JSON.stringify({error}), {status: 500})
    }
    if (!data) {
      return new Response(null, {status: 404})
    }
    const thread = data as Thread;
    const threadMessages = await openai.beta.threads.messages.list(
      thread.thread_id
    );
    return new Response(JSON.stringify(threadMessages.data), {status: 200})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}

// Send a new message to a thread
export async function POST(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  const input: {
    content: string;
    isFormattingAssistant: boolean;
  } = await req.json();
  try {
    const {params} = routeContextSchema.parse(context);
    const threadId = params.id;
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: input.content,
    });

    const stream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: input.isFormattingAssistant ? process.env.FORMATTING_ASSISTANT_ID! : process.env.ASSISTANT_ID!,
    });

    return new Response(stream.toReadableStream());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}
