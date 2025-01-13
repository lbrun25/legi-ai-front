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
    advanceNotice: string;
    referenceSalary: string;
    seniority: string;
  } = await req.json();

  try {
    const query = "Méthode de calcul de l'indemnité de licenciement selon la convention collective.";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
# Objectif
Calcul l’indemnité de licenciement en te basant sur les derniers bulletins de paie et sur la collection collective (${input.idcc}) puis effectue une double vérification de tes calculs.

# Règle de calcul:
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.
- Additionner l'ancienneté et le préavis afin de prendre en compte l’ancienneté jusqu’à la date de fin du préavis (si la convention collective l'autorise)

# Données disponibles :
- Préavis : ${input.advanceNotice}
- Ancienneté : ${input.seniority}
- Salaire de référence : ${input.referenceSalary}
- Derniers bulletins de paie :
\`\`\`
${input.bpAnalysisResponse}
\`\`\`

# Articles de la convention collective
Voici les articles pertinents de la convention collective (${input.idcc}) pour calculer l’indemnité de licenciement du salarié: 
${relevantArticlesText}

# Réponse attendue
- Retourne le montant final de l'indemnité, accompagné d'une explication claire des étapes de calcul.
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
À partir du texte suivant, extrait uniquement le montant de l'indemnité de licenciement avec le symbole de la monnaie. N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement le montant de l'indemnité de licenciement avec le symbole de la monnaie.
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
    console.error("cannot compute indemnities with convention:", error);
    return NextResponse.json({ message: 'Failed to compute indemnities with convention' }, { status: 500 });
  }
}
