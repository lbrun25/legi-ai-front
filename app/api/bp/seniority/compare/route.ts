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
    legalSeniority: string;
    conventionSeniority: string;
  } = await req.json();

  try {
    const prompt = `
Objectif :
Compare deux durées d'ancienneté et retourne uniquement la plus favorable sous forme numérique, suivie du mot "mois".

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.

Règles d'interprétation :
- Compare l'ancienneté légale (${input.legalSeniority}) et l'ancienneté conventionnelle (${input.conventionSeniority}).
- Sélectionne la durée la plus longue parmi les deux.
- Retourne uniquement le résultat sous le format : "Y années X mois".
- Ajoute une brève explication du choix effectué, mentionnant les valeurs comparées.

Données disponibles :
- Ancienneté légale : ${input.legalSeniority}
- Ancienneté conventionnelle : ${input.conventionSeniority}

Réponse attendue :
- Retourne uniquement la durée la plus favorable sous le format : "X années et Y mois".
- Ajoute une explication concise indiquant pourquoi cette durée a été choisie.
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.
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

    // 🔹 Second LLM Call: Extract Only the Value in "X mois" Format
    const extractionPrompt = `
Objectif :
À partir du texte suivant, extrait uniquement la durée de l'ancienneté sous le format "X années et Y mois". N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement la durée sous le format : "X années et Y mois".
`;
    const extractionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
    });
    const extractedValue = extractionResponse.choices[0].message.content?.trim() || "Erreur dans l'extraction du modèle";
    console.log('Extracted value:', extractedValue);

    return NextResponse.json({
      message: message,
      value: extractedValue,
    }, { status: 200 });
  } catch (error) {
    console.error("cannot compare seniority:", error);
    return NextResponse.json({ message: 'Failed to compare seniority' }, { status: 500 });
  }
}
