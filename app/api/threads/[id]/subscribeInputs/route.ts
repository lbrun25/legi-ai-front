import {NextRequest} from "next/server";
import {pubSubClient} from "@/lib/google/pubSubClient";
import {z} from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export async function GET(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  const {params} = routeContextSchema.parse(context);
  const threadId = params.id;

  if (!threadId) {
    return new Response('Thread ID is required', {status: 400});
  }

  const subscriptionName = `input-requests-sub`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create a subscription if it doesn't exist
        const [subscription] = await pubSubClient.subscription(subscriptionName).get({autoCreate: true});

        const messageHandler = (message: any) => {
          const data = JSON.parse(message.data.toString());
          console.log('received message:', data)
          if (data.threadId === threadId) {
            controller.enqueue(JSON.stringify(data));
            message.ack();
          }
        };

        // Listen for new messages
        subscription.on('message', messageHandler);

        // Handle connection close
        req.signal.addEventListener('abort', () => {
          subscription.removeListener('message', messageHandler);
          subscription.close();
          controller.close();
        });
      } catch (error) {
        console.error('Error subscribing to Pub/Sub:', error);
        controller.error('Error subscribing to Pub/Sub');
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    status: 200,
  });
}
