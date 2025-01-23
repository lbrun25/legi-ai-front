import {NextResponse} from "next/server";
import {searchArticlesInCollectiveAgreement} from "@/lib/supabase/agreements";
import {GoogleGenerativeAI} from "@google/generative-ai";
import OpenAI from "openai";
import {SeniorityValueResponse} from "@/lib/types/bp";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    sickDays: number;
    unjustifiedAbsenceDays: number;
    idcc: string;
    entryDate: string;
    notificationDate: string;
    lastPaySlip: string;
  } = await req.json();

  try {
    const query = "Comment déterminer l'ancienneté du salarié ?";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
Objectif :
Réponse attendue :
- Répond strictement et uniquement avec cette réponse: "Ancienneté selon la convention collective : XXXX".

Détermine avec précision l'ancienneté du salarié en utilisant les informations suivantes :
- La date d'entrée du salarié.
- La date de notification de licenciement.
- Les absences non justifiés ou les arrets maladie.
- Les articles pertinents de la convention collective (${input.idcc}).

Effectue ensuite une double vérification de tes calculs pour garantir leur exactitude.

Règles de calcul :
- Prends en compte :
   - Les périodes travaillées effectives.
   - Les absences rémunérées ou assimilées si elles sont précisées dans la convention collective.
   - Les éventuelles périodes exclues du calcul d'ancienneté selon les règles spécifiques de la convention collective.
- Calcule l'ancienneté en années et mois complets, en utilisant avec précision les dates d'entrée et de notification de licenciement.

Données disponibles :
- Nombre de jours en arrêts maladie : ${input.sickDays}
- Nombre de jours d'absence non justifiés : ${input.unjustifiedAbsenceDays}
- Date d'entrée du salarié : ${input.entryDate}
- Date de notification de licenciement : ${input.notificationDate}
- Articles pertinents de la convention collective (${input.idcc}) :
\`\`\`
${relevantArticlesText}
\`\`\`
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
À partir du texte suivant, extrait uniquement la durée de l'ancienneté sous le format strict suivant (sans aucun texte supplémentaire ou caractères non valides) :

{
"total_years": X,
"total_months": Y,
"formatted_duration": "X années et Y mois"
}

Le format attendu doit être un JSON valide. Si les données ne sont pas disponibles, retourne ce JSON : {"total_years": 0, "total_months": 0, "formatted_duration": "0 années et 0 mois"}.
Texte :  
"${message}"

Ne retourne rien d'autre que le JSON strict.
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
    const extractedValues = extractionResponse.choices[0].message.content?.trim() || "Erreur dans l'extraction du modèle";
    console.log('Extracted values:', extractedValues);

    let parsedValues: SeniorityValueResponse;
    try {
      parsedValues = JSON.parse(extractedValues) as SeniorityValueResponse;
      if (
        typeof parsedValues.total_years !== "number" ||
        typeof parsedValues.total_months !== "number" ||
        typeof parsedValues.formatted_duration !== "string"
      ) {
        throw new Error("Invalid format in the parsed response.");
      }
    } catch (error) {
      throw new Error("Erreur dans l'extraction du modèle : format JSON invalide.");
    }

    return NextResponse.json(
      {
        message: message,
        value: parsedValues,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot compute seniority with convention:", error);
    return NextResponse.json({ message: 'Failed to compute seniority with convention' }, { status: 500 });
  }
}
