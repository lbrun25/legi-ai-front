import {NextRequest, NextResponse} from 'next/server';
import {pubSubClient} from "@/lib/google/pubSubClient";

export async function POST(req: NextRequest) {
  try {
    const {threadId, userInput} = await req.json();

    if (!threadId || !userInput) {
      return NextResponse.json({error: 'Thread ID and user input are required'}, {status: 400});
    }

    const topic = pubSubClient.topic('input-responses');

    await topic.publishMessage({
      json: {threadId, userInput},
    });

    return NextResponse.json({message: 'User input sent'}, {status: 200});
  } catch (error) {
    console.error('Error publishing user input:', error);
    return NextResponse.json({error: 'Failed to send user input'}, {status: 500});
  }
}
