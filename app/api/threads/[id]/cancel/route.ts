import {z} from "zod";
import OpenAI from "openai";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Cancel a run in a thread
export async function POST(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  const input: {
    runId: string;
  } = await req.json();
  try {
    const {params} = routeContextSchema.parse(context);
    const threadId = params.id;
    const runId = input.runId;

    if (!runId)
      return new Response(JSON.stringify({reason: "runId is missing"}), {status: 400});

    const result = await openai.beta.threads.runs.cancel(threadId, input.runId);
    return new Response(JSON.stringify(result), {status: 200})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}
