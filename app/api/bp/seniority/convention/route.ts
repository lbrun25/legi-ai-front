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
    entryDate: string;
    notificationDate: string;
  } = await req.json();

  try {
    const query = "Comment déterminer l'ancienneté du salarié ?";
    const relevantArticles = await searchArticlesInCollectiveAgreement(input.idcc, query);
    const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
    const prompt = `
Objectif :
Détermine avec précision l'ancienneté du salarié en utilisant les informations suivantes :
- Les derniers bulletins de paie.
- La date d'entrée du salarié.
- La date de notification de licenciement.
- Les articles pertinents de la convention collective (${input.idcc}).

Effectue ensuite une double vérification de tes calculs pour garantir leur exactitude.

Règles de calcul :
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape de tes calculs.
- Prends en compte :
   - Les périodes travaillées effectives.
   - Les absences rémunérées ou assimilées si elles sont précisées dans la convention collective.
   - Les éventuelles périodes exclues du calcul d'ancienneté selon les règles spécifiques de la convention collective.
- Calcule l'ancienneté en années et mois complets, en utilisant avec précision les dates d'entrée et de notification de licenciement.

Données disponibles :
- **Derniers bulletins de paie :**
\`\`\`
${input.bpAnalysisResponse}
\`\`\`  

- **Date d'entrée du salarié :**  
${input.entryDate}  

- **Date de notification de licenciement :**
${input.notificationDate}  

- **Articles pertinents de la convention collective (${input.idcc}) :**
\`\`\`
${relevantArticlesText}
\`\`\`

Réponse attendue :
- Retourne l'ancienneté du salarié sous le format suivant : "X années et Y mois".
- Fournis une explication détaillée des calculs, incluant les règles appliquées et les hypothèses éventuelles.
- Assure-toi que les calculs ont été doublement vérifiés et qu'ils ne contiennent aucune erreur.
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
