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
    entryDate: string;
    bpPeriods: string[ ]
  } = await req.json();

  try {
    const prompt = `
Tu es un assistant spécialisé dans l'analyse de bulletins de paie.

Voici les informations extraites des bulletins de paie :
- Date d'entrée: ${input.entryDate}
- Périodes des bulletins de paie: ${input.bpPeriods.join(', ')} 

Analyse les données fournies et réponds STRICTEMENT en JSON brut, sans ajout de texte supplémentaire, sans utiliser de balises Markdown, et sans commentaire.

Utilise le format suivant :
{
  "entry_date": "<date d'entrée>",
  "last_pay_slip_date": <date du dernier bulletin de paie>
}

N'inclus aucun texte avant ou après le JSON, pas de texte explicatif, et pas de balises Markdown (\`\`\`json).
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
    const message = gptResponse.choices[0].message;
    console.log('message:', message);
    const jsonResponse = JSON.parse(message.content || "{}");
    return NextResponse.json(
      {
        employeeName: jsonResponse.employee_name,
        entryDate: jsonResponse.entry_date,
        earnedPaidLeave: jsonResponse.earned_paid_leave,
        lastPaySlipDate: jsonResponse.last_pay_slip_date,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot get employee info:", error);
    return NextResponse.json({ message: 'Failed to get employee info' }, { status: 500 });
  }
}
