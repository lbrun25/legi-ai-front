import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
import {searchArticlesInCollectiveAgreement} from "@/lib/supabase/agreements";
import OpenAI from "openai";
import {SeniorityValueResponse} from "@/lib/types/bp";
import {evaluateMathExpression, parseAndReplace} from "@/lib/utils/bp";

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
    referenceSalary: number;
    seniority: SeniorityValueResponse;
    employeeQualification: string | null;
    employeeClassificationLevel: string | null;
  } = await req.json();

  console.log('convention compute input.seniority:', input.seniority)
  console.log('convention compute input.referenceSalary:', input.referenceSalary)
  console.log('convention compute input.employeeQualification:', input.employeeQualification)
  console.log('convention compute input.employeeClassificationLevel:', input.employeeClassificationLevel)

  try {
    const query = "Méthode de calcul de l'indemnité de licenciement selon la convention collective.";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
# Articles de la convention collective
Voici les articles pertinents de la convention collective (${input.idcc}) concernant l’indemnité de licenciement: 
${relevantArticlesText}

# Objectif
Répond uniquement par la formule a calculer pour:
- une ancienneté de ${input.seniority.formatted_duration}.
${input.employeeQualification && `- une qualification: ${input.employeeQualification}`}
${input.employeeClassificationLevel && `- un niveau de classification: ${input.employeeClassificationLevel}`}

# Règle de calcul:
- Prends en compte la qualification du salarié, si il est cadre, la formule peut etre différente par exemple.
- Ne soustrait pas des années d'ancienneté.
- Additionne les mois restants dans la formule en les convertissant en fraction d’année (mois/12) si ce n'est pas deja fait.
- N'additionnes pas les primes et les avantages natures si la convention collective ne les indique pas.
- Si des informations sont à inclure dans la formule, utilise des placeholders de type [PLACEHOLDER]:
    - Si salaire de reference à inclure: [REFERENCE]
    - Si primes à inclure: [PRIMES]
    - Si avantages natures à inclure: [BENEFITS]

# Réponse attendue
- Retourne uniquement la formule à calculer en réponse, en notation arithmétique standard (uniquement des chiffres, opérateurs arithmétiques et parenthèses), sans aucun formatage LaTeX.
  `;
    console.log('prompt:', prompt)
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const message = response.choices[0].message.content?.trim()
    console.log('message:', message);

    if (!message || message?.length === 0) {
      console.error('collective convention formula is empty');
      return;
    }

    const replacements = {
      REFERENCE: input.referenceSalary,
      PRIMES: input.totalPrimes,
      BENEFITS: input.totalFringeBenefits,
    };
    const parsedExpression = parseAndReplace(message, replacements);
    const result = evaluateMathExpression(parsedExpression);
    console.log("Résultat de l'expression:", result);

    return NextResponse.json({
      message: parsedExpression,
      value: result,
    }, { status: 200 });
  } catch (error) {
    console.error("cannot compute indemnities with convention:", error);
    return NextResponse.json({ message: 'Failed to compute indemnities with convention' }, { status: 500 });
  }
}
