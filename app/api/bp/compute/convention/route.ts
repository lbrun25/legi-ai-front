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
    totalPrimes: number;
    totalFringeBenefits: number;
    idcc: string;
    referenceSalary: string;
    seniority: string;
  } = await req.json();

  console.log('convention compute input.seniority:', input.seniority)
  console.log('convention compute input.referenceSalary:', input.referenceSalary)

  try {
    const query = "Méthode de calcul de l'indemnité de licenciement selon la convention collective.";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
# Objectif
Calcul l’indemnité de licenciement en te basant sur les données disponibles et sur la collection collective (${input.idcc}).

# Règle de calcul:
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs.

# Données disponibles :
- Ancienneté : ${input.seniority}
- Salaire de référence : ${input.referenceSalary}
- Total des primes : ${input.totalPrimes}
- Total des avantages natures : ${input.totalFringeBenefits}

# Articles de la convention collective
Voici les articles pertinents de la convention collective (${input.idcc}) pour calculer l’indemnité de licenciement du salarié: 
${relevantArticlesText}

# Réponse attendue
- Retourne le montant final de l'indemnité, accompagné accompagné de la formule et d'une brève explication claire de ton raisonnement.
- N'affiche pas le code Python dans ta réponse car ce n'est pas une réponse claire à donner à l'utilisateur.
- Réponds uniquement par cette réponse : "Selon la convention collective : [FORMULE SELON LA CONVENTION Collective] = [Résultat]"
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
    console.error("cannot compute indemnities with convention:", error);
    return NextResponse.json({ message: 'Failed to compute indemnities with convention' }, { status: 500 });
  }
}
