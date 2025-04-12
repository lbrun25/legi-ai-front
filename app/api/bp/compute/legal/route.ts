import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TODO: inclure "Cas Particuliers" cf Notion

export async function POST(req: Request) {
  const input: {
    seniority: string;
    referenceSalary: string;
  } = await req.json();

  console.log('legal compute input.seniority:', input.seniority)
  console.log('legal compute input.referenceSalary:', input.referenceSalary)


  try {
    const prompt = `
# Règle de calcul:
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.

# Calculer l'indemnité légale
L’indemnité légale de licenciement est calculée en fonction de l’ancienneté du salarié :
• 1/4 de mois de salaire par année d’ancienneté pour les années jusqu’à 10 ans.
• 1/3 de mois de salaire par année d’ancienneté pour les années au-delà de 10 ans.
 
# Données disponibles :
- Salaire de référence : ${input.referenceSalary}
- Ancienneté : ${input.seniority}

# Réponse attendue
- Retourne le montant final de l'indemnité, accompagné de la formule et d'une brève explication claire de ton raisonnement.
- N'affiche pas le code Python dans ta réponse car ce n'est pas une réponse claire à donner à l'utilisateur.
- Réponds uniquement par cette réponse : "Selon la loi : [FORMULE LEGALE] = [Résultat]"
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
À partir du texte suivant, extrait uniquement le montant (le nombre) de l'indemnité de licenciement. N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement le montant de l'indemnité de licenciement.
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
    console.error("cannot compute legal indemnities:", error);
    return NextResponse.json({ message: 'Failed to compute legal indemnities' }, { status: 500 });
  }
}
