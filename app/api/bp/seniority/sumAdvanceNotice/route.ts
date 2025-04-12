import {NextResponse} from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    seniority: string;
    advanceNotice: string;
  } = await req.json();

  try {
    const prompt = `
Objectif :
Ton rôle est d'additionner l'ancienneté avec le préavis.

Données disponibles :
- Ancienneté : ${input.seniority}
- Préavis : ${input.advanceNotice}

Réponse attendue :
- Réponds uniquement : "Y années et X mois".
`;
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const message = gptResponse.choices[0].message.content;
    console.log('message:', message);

    return NextResponse.json({
      message: message,
    }, { status: 200 });
  } catch (error) {
    console.error("cannot compare seniority:", error);
    return NextResponse.json({ message: 'Failed to compare seniority' }, { status: 500 });
  }
}
