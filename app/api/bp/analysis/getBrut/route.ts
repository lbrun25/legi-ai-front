import {NextResponse} from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function calculateSickLeaveDays(period: string) {
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
  console.log('message:', message);
  const jsonResponse = JSON.parse(message.content || "{}");
  return jsonResponse.working_days;
}

export async function POST(req: Request) {
  const input: {
    bpResponse: string;
  } = await req.json();

  try {
    const prompt = `
Tu es un assistant spécialisé dans l'analyse de bulletins de paie.

Voici les informations extraites d'un bulletin de paie : 
"${input.bpResponse}"

Analyse les données fournies et réponds STRICTEMENT en JSON brut, sans ajout de texte supplémentaire, sans utiliser de balises Markdown, et sans commentaire.

Utilise le format suivant :
{
  "salaire_brut": <valeur numérique du salaire brut>,
  "periode_de_paie": "<période de paie exacte>",
  "avantage_nature": <montant de l'avantage nature>,
  "arret_maladie": <période de l'arret de la maladie ou nombre de jours étant à l'arrêt>,
  "primes": <montant total des primes>,
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

    const sickLeaveDays = await calculateSickLeaveDays(jsonResponse.arret_maladie);
    console.log("sickLeaveDays:", sickLeaveDays);

    return NextResponse.json(
      {
        brut: jsonResponse.salaire_brut,
        period: jsonResponse.periode_de_paie,
        natureAdvantage: jsonResponse.avantage_nature,
        premiums: jsonResponse.primes,
        sickLeavePeriod: jsonResponse.arret_maladie,
        sickLeaveWorkingDays: sickLeaveDays,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot get brut info:", error);
    return NextResponse.json({ message: 'Failed to get brut info' }, { status: 500 });
  }
}
