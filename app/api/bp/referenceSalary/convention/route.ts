import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
import {searchArticlesInCollectiveAgreement} from "@/lib/supabase/agreements";
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
    idcc: string;
    conventionSeniority: string;
  } = await req.json();

  try {
    const query = "Méthode de calcul du salaire de référence selon la convention collective.";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
Objectif :  
Calcule le salaire de référence du salarié conformément à la convention collective (${input.idcc}).

Règles de calcul :  
- Analyse les articles de la convention collective pour identifier la méthode spécifique de calcul du salaire de référence.  
- Prends en compte les périodes d'ancienneté et les bulletins de paie fournis.  
- Effectue les calculs à l'aide d'un interpréteur Python pour assurer la précision.  
- Retourne un résultat clair et structuré.

Données disponibles :  
- Ancienneté du salarié : ${input.conventionSeniority}  
- Derniers bulletins de paie :
\`\`\`
${input.bpAnalysisResponse}
\`\`\`
- Articles pertinents de la convention collective :  
\`\`\`
${relevantArticlesText}
\`\`\`

Réponse attendue :
- Fournis une explication concise du raisonnement utilisé pour déterminer le salaire de référence.  
- Retourne le salaire de référence calculé sous le format suivant : "Salaire de référence : X euros".
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.
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
À partir du texte suivant, extrait uniquement le montant du salaire de référence. N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement le montant du salaire de référence avec le symbole de la monnaie.
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
    console.error("cannot compute reference salary with convention:", error);
    return NextResponse.json({ message: 'Failed to compute reference salary with convention' }, { status: 500 });
  }
}
