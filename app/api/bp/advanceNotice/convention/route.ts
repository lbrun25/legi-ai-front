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
    bpAnalysisResponse: string;
    idcc: string;
    seniority: string;
  } = await req.json();

  try {
    const query = "Quel est le délai de préavis prévu par la convention collective en cas de licenciement ?"
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
Objectif :
Détermine le délai de préavis applicable pour un salarié licencié selon les articles pertinents de la convention collective identifiée par l'IDCC ${input.idcc}.

Règles de calcul :
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape de tes calculs.

Règles d'interprétation :
- Analyse les articles fournis de la convention collective pour déterminer la durée du préavis applicable. 
- Prends en compte l'ancienneté du salarié si elle est mentionnée dans les articles fournis.
- Si plusieurs règles ou scénarios sont mentionnés, sélectionne le cas qui correspond le mieux à une ancienneté de ${input.seniority}.
- Retourne la durée du préavis sous forme numérique, suivie du mot "mois" (exemple : "2 mois").
- Ajoute une brève explication de ton raisonnement, en mentionnant les points clés des articles utilisés pour arriver à ta conclusion.

Données disponibles :
- IDCC : ${input.idcc}
- Ancienneté du salarié : ${input.seniority}
- Articles pertinents de la convention collective :
\`\`\`
${relevantArticlesText}
\`\`\`

Réponse attendue :
- Retourne la durée du préavis sous le format : "X mois".
- Ajoute une brève explication du raisonnement qui a conduit à ce résultat.
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
