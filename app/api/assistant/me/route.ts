import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function GET(req: Request) {
  try {
    const assistant = await openai.beta.assistants.retrieve(
      process.env.ASSISTANT_ID ??
      (() => {
        throw new Error('ASSISTANT_ID is not set');
      })(),
    );
    return new Response(JSON.stringify(assistant), { status: 200 })
  } catch (error) {
    console.error("cannot retrieve the assistant:", error);
    return new Response(null, { status: 500 })
  }
}
