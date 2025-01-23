import {NextResponse} from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function calculateSickLeaveDays(period: string) {
  // TODO: Use hours to define sick leave working days or define a schedule for the day offs
  const prompt = `
Ton rôle est de calculer les jours travaillés pour cette période ${period} pour un salarié travaillant du lundi au vendredi (hors week-end) en CDI.
Réponds STRICTEMENT en JSON brut, sans ajout de texte supplémentaire, sans utiliser de balises Markdown, et sans commentaire.
Utilise un calendrier pour être précis dans ton interprétation et utilise un interprète Python pour effectuer chacun de tes calculs.
Utilise le format suivant :
{
  "working_days": <nombre de jours non travaillé>,
}

N'inclus aucun texte avant ou après le JSON, pas de texte explicatif, et pas de balises Markdown (\`\`\`json).
  `;
  console.log('prompt:', prompt);
  const gptResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {type: "text", text: prompt},
        ],
      },
    ],
  });
  const message = gptResponse.choices[0].message;
  console.log('period:', period);
  console.log('message:', message);
  const jsonResponse = JSON.parse(message.content || "{}");
  return parseFloat(jsonResponse.working_days || "0");
}

export async function POST(req: Request) {
  const input: {
    sickLeavePeriod: string;
  } = await req.json();

  try {
    const sickLeaveDays = await calculateSickLeaveDays(input.sickLeavePeriod);
    console.log("sickLeaveDays:", sickLeaveDays);

    return NextResponse.json(
      {
        sickLeaveWorkingDays: sickLeaveDays,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot get sick leave working days:", error);
    return NextResponse.json({ message: 'Failed to get sick leave working days' }, { status: 500 });
  }
}
