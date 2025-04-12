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
    legalAdvanceNotice: string;
    conventionAdvanceNotice: string;
  } = await req.json();

  try {
    const prompt = `
Objectif :
Compare deux durées de préavis et retourne uniquement la plus favorable sous forme numérique, suivie du mot "mois".

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.

Règles d'interprétation :
- Compare le préavis légal (${input.legalAdvanceNotice}) et le préavis conventionnel (${input.conventionAdvanceNotice}).
- Sélectionne la durée la plus longue parmi les deux.
- Retourne uniquement le résultat sous le format : "X mois".
- Ajoute une brève explication du choix effectué, mentionnant les valeurs comparées.

Données disponibles :
- Préavis légal : ${input.legalAdvanceNotice}
- Préavis conventionnel : ${input.conventionAdvanceNotice}

Réponse attendue :
- Retourne uniquement la durée la plus favorable sous le format : "X mois".
- Ajoute une explication concise indiquant pourquoi cette durée a été choisie.
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.
`;
    const comparisonResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    const comparisonMessage = comparisonResponse.choices[0].message.content?.trim() || "Erreur dans la réponse du modèle";
    console.log('message:', comparisonMessage);

    // 🔹 Second LLM Call: Extract Only the Value in "X mois" Format
    const extractionPrompt = `
Objectif :
À partir du texte suivant, extrait uniquement la durée du préavis sous le format "X mois". N'inclus aucun autre texte ou explication.

Texte :  
"${comparisonMessage}"

Réponse attendue :  
Retourne uniquement la durée sous le format : "X mois".
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

    return NextResponse.json(
      {
        message: comparisonMessage,
        value: extractedValue,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot compare advance notice:", error);
    return NextResponse.json({message: 'Failed to compare advance notice'}, {status: 500});
  }
}
