import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {pubSubClient} from "@/lib/google/pubSubClient";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export async function POST(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  const {params} = routeContextSchema.parse(context);
  const threadId = params.id;
  const input: {
    userInputs: Record<string, string>;
  } = await req.json();

  try {
    console.log('will publish user inputs:', input.userInputs);
    const topic = pubSubClient.topic('input-responses');
    await topic.publishMessage({
      json: {threadId, userInputs: input.userInputs},
    });
    return NextResponse.json({message: 'User input request published'});
  } catch (error) {
    console.error('Error publishing to Pub/Sub:', error);
    return NextResponse.json(error, {status: 500});
  }
}
