import {NextResponse} from "next/server";
import OpenAI from "openai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    legalReferenceSalary: string;
    conventionReferenceSalary: string;
  } = await req.json();

  try {
    const prompt = `
Objectif :
Compare deux salaire de référence et indique celui qui est le plus favorable.

Règles de calcul :  
- Utilise un interpréteur Python pour effectuer et vérifier chaque étape du calcul.

Règles d'interprétation :  
- Analyse les deux salaires de référence fournis.  
- Sélectionne le salaire de référence le plus élevé comme étant le plus favorable.  
- Justifie brièvement le choix effectué en expliquant pourquoi ce salaire de référence a été retenu.  
- Assure-toi que ton raisonnement est clair et concis.

Données disponibles :
- Salaire de référence légale : ${input.legalReferenceSalary}
- Salaire de référence conventionnelle : ${input.conventionReferenceSalary}

Réponse attendue :
- Ajoute une explication concise indiquant pourquoi ce salaire de référence a été choisie.
- La réponse doit être concise, structuré en affichant clairement le montant et l'étape de calcul (sans afficher le résultat calculé par Python) afin qu'un humain comprenne.
`;
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const message = gptResponse.choices[0].message.content;
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
    console.error("cannot compare reference salary:", error);
    return NextResponse.json({ message: 'Failed to compare reference salary' }, { status: 500 });
  }
}
