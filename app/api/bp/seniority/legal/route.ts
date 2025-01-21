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

// TODO: use notification date

export async function POST(req: Request) {
  const input: {
    sickDays: number;
    unjustifiedAbsenceDays: number;
    entryDate: string;
    notificationDate: string;
    lastPaySlip: string;
  } = await req.json();

  console.log('legal seniority:', `
    - Date du dernier bulletin de paie : ${input.lastPaySlip}
    - Date d'entrée du salarié dans l'entreprise : ${input.entryDate}
    - Date de notification de licenciement : ${input.notificationDate}
    - Nombre de jours en arrêts maladie : ${input.sickDays}
    - Nombre de jours d'absence non justifiés : ${input.unjustifiedAbsenceDays}`)

  try {
    const prompt = `
    Objectif :
    Calcule l'ancienneté légale du salarié en te basant sur les données fournies, notamment la date d'entrée du salarié et la date de notification de licenciement. Assure-toi d'effectuer une vérification rigoureuse des calculs.
    
    Réponse attendue :
    - Répond strictement et uniquement avec cette réponse: "Ancienneté selon la loi : XXXX".

    Règles de calcul :
    - Attention si la différence entre la date de notification de licenciement et la date du dernier bulletin de paie du salarié, considère que le salarié a été en arret maladie après la date de son dernier bulletin de paie.
      Donc tu ne doit pas prendre en compte cette période dans l'ancienneté.
    - L'ancienneté est calculée en années et mois complets entre la date d'entrée et la date de notification de licenciement.
    - Prends en compte uniquement les périodes travaillées effectives et les absences assimilées comme du temps de travail selon les règles légales.
    - Valide la continuité du contrat de travail à l'aide des bulletins de paie pour éviter toute erreur dans les périodes calculées.
    - Vérifie que chaque étape du calcul est cohérente avec les règles du Code du travail.

    Données disponibles :
    - Date d'entrée du salarié dans l'entreprise : ${input.entryDate}
    - Date de notification de licenciement : ${input.lastPaySlip}
    - Nombre de jours en arrêts maladie : ${input.sickDays}
    - Nombre de jours d'absence non justifiés : ${input.unjustifiedAbsenceDays}
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
À partir du texte suivant, extrait uniquement la durée de l'ancienneté sous le format "X années et Y mois". N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement la durée sous le format : "X années et Y mois".
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
    console.error("cannot compute seniority with convention:", error);
    return NextResponse.json({ message: 'Failed to compute seniority with convention' }, { status: 500 });
  }
}
