import {NextResponse} from "next/server";
import {searchArticlesInCollectiveAgreement} from "@/lib/supabase/agreements";
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
    idcc: string;
    seniority: string;
  } = await req.json();

  console.log('[convention] input seniority:', input.seniority);

  try {
    const query = "Quel est le délai de préavis prévu par la convention collective en cas de licenciement ?"
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    console.log('seniority convention:', input.seniority);
    console.log('relevantArticles convention:', relevantArticlesText);
    const prompt = `
Objectif :
Détermine le délai de préavis applicable pour un salarié licencié selon les articles pertinents de la convention collective identifiée par l'IDCC ${input.idcc}.

Réponse attendue :
- Répond strictement et uniquement avec cette réponse: "Durée du préavis selon la convention collective : XXXXX" 

Règles d'interprétation :
- Analyse les articles fournis de la convention collective pour déterminer la durée du préavis applicable. 
- Prends en compte l'ancienneté du salarié si elle est mentionnée dans les articles fournis.
- Si plusieurs règles ou scénarios sont mentionnés, sélectionne le cas qui correspond le mieux à une ancienneté de ${input.seniority}.
- Retourne la durée du préavis sous forme numérique, suivie du mot "mois" (exemple : "2 mois").

Données disponibles :
- IDCC : ${input.idcc}
- Ancienneté du salarié : ${input.seniority}
- Articles pertinents de la convention collective : ${relevantArticlesText}
  `;
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const message = response.choices[0].message.content?.trim()
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
    console.error("cannot compute advance notice with convention:", error);
    return NextResponse.json({ message: 'Failed to compute advance notice with convention' }, { status: 500 });
  }
}
