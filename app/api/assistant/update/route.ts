import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: Request) {
  const input: {
    assistant: OpenAI.Beta.Assistants.AssistantUpdateParams;
  } = await req.json();

  try {
    const updatedAssistant = await openai.beta.assistants.update(
      process.env.ASSISTANT_ID ??
      (() => {
        throw new Error('ASSISTANT_ID is not set');
      })(),
      input.assistant
    );
    return new Response(JSON.stringify(updatedAssistant), { status: 200 })
  } catch (error) {
    console.error("cannot update the assistant:", error);
    return new Response(null, { status: 500 })
  }
}
