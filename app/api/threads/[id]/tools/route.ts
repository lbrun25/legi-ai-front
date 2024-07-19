import OpenAI from "openai";
import {z} from "zod";
import {RunSubmitToolOutputsParams} from "openai/resources/beta/threads/runs/runs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export async function POST(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  const input: {
    toolCallOutputs: Array<RunSubmitToolOutputsParams.ToolOutput>;
    runId: string;
  } = await req.json();
  try {
    const {params} = routeContextSchema.parse(context)

    const stream = openai.beta.threads.runs.submitToolOutputsStream(
      params.id,
      input.runId,
      {tool_outputs: input.toolCallOutputs}
    );
    return new Response(stream.toReadableStream());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), {status: 422})
    }
    return new Response(null, {status: 500})
  }
}
