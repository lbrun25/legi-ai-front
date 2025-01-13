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

export async function POST(req: Request) {
  const input: {
    bpAnalysisResponse: string;
    entryDate: string;
    notificationDate: string;
  } = await req.json();

  try {
    const prompt = `
    Objectif :
    Calcule l'ancienneté légale du salarié en te basant sur les données fournies, notamment la date d'entrée du salarié, la date de notification de licenciement et les derniers bulletins de paie. Assure-toi d'effectuer une vérification rigoureuse des calculs.

    Règles de calcul :
    - Utilise un interpréteur Python pour effectuer chaque étape du calcul.
    - L'ancienneté est calculée en années et mois complets entre la date d'entrée et la date de notification de licenciement.
    - Prends en compte uniquement les périodes travaillées effectives et les absences assimilées comme du temps de travail selon les règles légales.
    - Valide la continuité du contrat de travail à l'aide des bulletins de paie pour éviter toute erreur dans les périodes calculées.
    - Vérifie que chaque étape du calcul est cohérente avec les règles du Code du travail.

    Données disponibles :
    - Date d'entrée du salarié : ${input.entryDate}
    - Date de notification de licenciement : ${input.notificationDate}
    - Bulletins de paie du salarié : ${input.bpAnalysisResponse}

    Réponse attendue :
    - Retourne l'ancienneté du salarié sous le format : "X années et Y mois".
    - Inclue une explication détaillée des calculs effectués, en indiquant les étapes intermédiaires et les hypothèses éventuelles.
    - Assure-toi que le résultat final est vérifié et précis.
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
