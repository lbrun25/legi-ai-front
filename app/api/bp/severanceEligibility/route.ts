import { NextResponse } from "next/server";
import { searchArticlesInCollectiveAgreement } from "@/lib/supabase/agreements";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Évalue l'éligibilité légale à une indemnité de licenciement.
 * Retourne une explication textuelle détaillant le raisonnement.
 */
async function getLegalSeveranceEligibility(legalSeniority: string, bpAnalysisResponse: string): Promise<string> {
  const prompt = `
Objectif :  
Détermine si le salarié peut bénéficier d'une indemnité de licenciement en se basant uniquement sur le calcul légal.

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.

Règles d'interprétation :  
- Vérifie que l'ancienneté du salarié est suffisante (généralement au moins 8 mois).  
- Vérifie que le motif du licenciement n'est pas une faute grave ou lourde.  
- Analyse les bulletins de paie pour confirmer l'ancienneté et les conditions de licenciement.

Données disponibles :  
- Ancienneté du salarié : ${legalSeniority}  
- Derniers bulletins de paie :  
\`\`\`
${bpAnalysisResponse}
\`\`\`

Réponse attendue :  
- Retourne une explication concise et claire indiquant si, selon le calcul légal, le salarié remplit les critères pour bénéficier d'une indemnité de licenciement.
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.  
`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  return result.response.text().trim();
}

/**
 * Évalue l'éligibilité conventionnelle à une indemnité de licenciement.
 * Retourne une explication textuelle détaillant le raisonnement.
 */
async function getConventionSeveranceEligibility(conventionSeniority: string, bpAnalysisResponse: string, idcc: string): Promise<string> {
  const query = "Est-ce que le salarié a le droit à une indemnité de licenciement ?";
  const relevantArticles = await searchArticlesInCollectiveAgreement(idcc, query);
  const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');

  const prompt = `
Objectif :  
Détermine si le salarié peut bénéficier d'une indemnité de licenciement selon les dispositions de la convention collective (${idcc}).

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.

Règles d'interprétation :  
- Analyse les articles pertinents de la convention collective pour vérifier les critères d'éligibilité.  
- Vérifie que l'ancienneté du salarié est suffisante selon les règles établies.  
- Assure-toi que le motif du licenciement respecte les conditions prévues par la convention collective.

Données disponibles :  
- Ancienneté du salarié : ${conventionSeniority}  
- Derniers bulletins de paie :  
\`\`\`
${bpAnalysisResponse}
\`\`\`
- Articles pertinents de la convention collective :  
\`\`\`
${relevantArticlesText}
\`\`\`

Réponse attendue :  
- Retourne une explication concise et claire indiquant si, selon la convention collective, le salarié remplit les critères pour bénéficier d'une indemnité de licenciement.
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.  
`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  return result.response.text().trim();
}

/**
 * Compare les deux messages d'éligibilité pour déterminer si un droit existe.
 */
async function compareSeveranceEligibility(legalMessage: string, conventionMessage: string): Promise<boolean> {
  const prompt = `
Objectif :  
Analyse les deux messages suivants et détermine si l'un des deux indique clairement que le salarié a droit à une indemnité de licenciement.

Données disponibles :  
- Message du calcul légal : "${legalMessage}"  
- Message de la convention collective : "${conventionMessage}"

Règles d'interprétation :  
- Si l'un des deux messages contient une affirmation claire indiquant que le salarié a droit à une indemnité, retourne "true".  
- Si aucun des deux messages ne contient d'affirmation positive, retourne "false".  
- Ne retourne que "true" ou "false".

Réponse attendue :  
- Retourne uniquement "true" si un des deux messages confirme un droit à indemnité.  
- Retourne uniquement "false" si aucun des deux messages ne le confirme.
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
  return message?.trim()?.toLowerCase() === "true";
}

/**
 * Route principale pour vérifier l'éligibilité à une indemnité de licenciement.
 */
export async function POST(req: Request) {
  const input: {
    bpAnalysisResponse: string;
    idcc: string;
    legalSeniority: string;
    conventionSeniority: string;
  } = await req.json();

  try {
    const legalMessage = await getLegalSeveranceEligibility(input.legalSeniority, input.bpAnalysisResponse);
    const conventionMessage = await getConventionSeveranceEligibility(input.conventionSeniority, input.bpAnalysisResponse, input.idcc);
    const finalEligibility = await compareSeveranceEligibility(legalMessage, conventionMessage);

    return NextResponse.json({
      severanceEligibility: finalEligibility,
      legalExplanation: legalMessage,
      conventionExplanation: conventionMessage
    }, { status: 200 });
  } catch (error) {
    console.error("Error computing severance eligibility:", error);
    return NextResponse.json({ message: 'Failed to compute severance eligibility' }, { status: 500 });
  }
}
