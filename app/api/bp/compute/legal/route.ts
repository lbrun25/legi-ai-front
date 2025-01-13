import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
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
    advanceNotice: string;
    referenceSalary: string;
    seniority: string;
  } = await req.json();

  try {
    const prompt = `
# Règle de calcul:
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.
- Prendre en compte l’ancienneté jusqu’à la date de fin du préavis

# Calculer l'indemnité légale
L’indemnité légale de licenciement est calculée en fonction de l’ancienneté du salarié :
• 1/4 de mois de salaire par année d’ancienneté pour les années jusqu’à 10 ans.
• 1/3 de mois de salaire par année d’ancienneté pour les années au-delà de 10 ans.
Exemple : Pour un salarié ayant un salaire de référence de 2 000 € et une ancienneté de 12 ans :
- Pour les 10 premières années : (2000 x (1/4) x 10) = 5000
- Pour les 2 années suivantes : (2000 x (1/3) x 2) = 1333.33
- Total : 6333.33

NB : Considérer les Années Incomplètes. Si l’année d’ancienneté est incomplète, l’indemnité est calculée proportionnellement au nombre de mois complets.
Par exemple, pour une ancienneté de 10 ans et 6 mois :
Les 6 mois supplémentaires seraient comptés comme (Salaire x (1/4) x (6/12))

## Cas Particuliers
1. Travail à Temps Partiel : Si le salarié a travaillé à temps partiel pendant une partie de son contrat, l’indemnité doit être calculée séparément pour chaque période (temps plein et temps partiel).
2. En cas de licenciement pour faute grave ou lourde : pas d’indemnité.
3. L'indemnité de licenciement, qu'elle soit d'origine légale, conventionnelle ou prévue par le contrat de travail, peut être cumulée avec les indemnités suivantes :
  - Indemnité compensatrice de préavis
  - Indemnité compensatrice de congés payés
  - Indemnité pour licenciement irrégulier, sans cause réelle et sérieuse ou nul
  - Indemnité allouée par le juge en cas de requalification d'un CDD en CDI
  - Contrepartie pécuniaire prévue en cas de clause de non-concurrence
  - Indemnité forfaitaire égale à 6 mois de salaire accordée au salarié dont le contrat de travail a été dissimulé.
 
# Données disponibles :
- Préavis : ${input.advanceNotice}
- Salaire de référence : ${input.referenceSalary}
- Ancienneté : ${input.seniority}
- Derniers bulletins de paie :
\`\`\`
${input.bpAnalysisResponse}
\`\`\`

# Réponse attendue
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
    console.error("cannot compute legal indemnities:", error);
    return NextResponse.json({ message: 'Failed to compute legal indemnities' }, { status: 500 });
  }
}
