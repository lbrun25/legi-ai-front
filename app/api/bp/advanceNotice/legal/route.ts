import {NextResponse} from "next/server";
import {GoogleGenerativeAI} from "@google/generative-ai";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    bpAnalysisResponse: string;
    seniority: string;
  } = await req.json();

  try {
    const prompt = `
Objectif :
Calcule le délai de préavis applicable pour un salarié licencié en suivant les règles légales françaises prévues par le Code du travail.

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.
- Calcule le préavis en fonction de l’ancienneté du salarié, exprimée en années et mois.
- Assure-toi que chaque étape du calcul respecte les règles générales du Code du travail.

Règles d'interprétation :
- Si plusieurs scénarios sont possibles selon l'ancienneté, applique la règle correspondant précisément à une ancienneté de ${input.seniority}.
- Prends en compte uniquement les règles légales standards sans référence à une convention collective ou un accord spécifique.
- Retourne la durée du préavis sous forme numérique, suivie du mot "mois" (exemple : "2 mois").
- Ajoute une explication concise de ton raisonnement en mentionnant les articles ou principes clés du Code du travail qui ont guidé ton calcul.

Données disponibles :
- Ancienneté du salarié : ${input.seniority}
- Bulletins de paie du salarié :
\`\`\`
${input.bpAnalysisResponse}
\`\`\`

Réponse attendue :
- Retourne la durée du préavis sous le format : "X mois".
- Ajoute une explication concise du raisonnement, incluant les articles du Code du travail ou les règles légales appliquées pour arriver au résultat.
- - La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.
`;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent({
      contents: [
        {
          role: "user", parts: [
            {text: prompt},
          ]
        }
      ]
    });
    const message = result.response.text();
    console.log('message:', message);

    // 🔹 Second LLM Call: Extract Only the Value in "X mois" Format
    const extractionPrompt = `
Objectif :
À partir du texte suivant, extrait uniquement la durée du préavis sous le format "X mois". N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

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

    return NextResponse.json({
      message: message,
      value: extractedValue,
    }, { status: 200 });
  } catch (error) {
    console.error("cannot compute legal advance notice:", error);
    return NextResponse.json({ message: 'Failed to compute legal advance notice' }, { status: 500 });
  }
}
