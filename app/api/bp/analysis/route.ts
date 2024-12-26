import {NextResponse} from "next/server";
import OpenAI from "openai";
// import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  const input: {
    filename: string;
    fileBase64: string;
  } = await req.json();

  try {
    const prompt = `
    Tu es un assistant spécialisé dans l'extraction d'informations précises à partir d'un bulletin de paie.
    
    ### Instructions Générales :
    
    1. Analyse des montants avec séparateurs multiples :
    Lors de l'extraction des montants, vérifie si les séparateurs décimaux sont :
    - Le point (.)
    - La virgule (,),
    - Une ligne verticale (|).
    Règle 1 : Si une ligne verticale est utilisée comme séparateur de décimales (ex : 5|00), interprète et convertis cette valeur en 5.00.
    
    2. Formats de bulletins de paie :
    Il existe deux formats à considérer :
    - Format avec colonne horizontale pour les décimales :
    Lorsque les décimales ne sont pas explicitement notées, considère que les deux derniers chiffres du montant représentent les décimales.
    Par exemple : 500 devient 5.00, et 12345 devient 123.45.
    - Format avec décimales explicites :
    Lorsque les décimales sont explicitement notées à l'aide d'un point (.) ou d'une virgule (,), interprète directement le montant tel quel.
    Par exemple : 5.00 ou 5,00.
    Règle 2 : Adapte l'interprétation en fonction du format détecté (colonne horizontale ou séparation explicite).

    3. Double vérification des montants :
    Pour chaque montant extrait :

    - Compare sa position dans la colonne appropriée.
    - Assure-toi qu'il ne s'agit pas d'une erreur de lecture ou d'une interprétation incorrecte des séparateurs (ligne verticale ou espaces).
    - Si une valeur semble incohérente (exemple : absence de décimales), signale-le avec :
    "Vérification nécessaire : Montant ambigu"

    4. Fiabilité accrue par parsing systématique :
    Pour les montants spécifiques (exemple : Salaire brut, Avantages en nature, Primes, etc.), lis systématiquement chaque chiffre et séparateur. En cas de doute, transcris les deux interprétations possibles. 
    
    5. Visibilité stricte des informations :
    Réponds exclusivement en te basant sur les données visibles dans le document. Ne fais aucune supposition ou déduction non justifiée par le contenu.
    
    6. Traitement des données manquantes :
    Si une information est manquante ou illisible :
    - Utilise Non trouvé pour une absence.
    - Utilise Illisible pour des données partiellement visibles mais ambiguës.
    
    7. Structure de réponse :
    La réponse doit être claire, concise et dans un format exploitable. Utilise toujours les points (.) pour les décimales.
    
    8. Ambiguïté signalée :
    Si des libellés ou informations sont ambigus, signale l'ambiguïté sans prendre de décision arbitraire.
    
    9. Précision avant complétude :
    Ne fournis aucune réponse partielle ou approximative si les données ne sont pas fiables.
    
    ### Questions à Extraire :
    - Salaire brut : Quel est le salaire brut total ?
    - Date d’entrée : Quelle est la date d’entrée dans l’entreprise ?
    - Période de paie : Quelle est la période couverte par ce bulletin ?
    - Classification : Quelle est la classification du salarié ? (exemple: Cadre, Agent de Maitrise, Chargé d’enquête intermittent, Employé, Technicien)
    - Arrêt de travail : Y a-t-il eu un arrêt de travail ? Si oui de combien de temps ?
    - Travail à temps partiel : Est-ce un travail à temps partiel ?
    - Primes : Des primes ont-elles été versées ? (ex : prime de fin d’année, treizième mois) et quel est leur montant ?
    - Commissions : Y a-t-il eu des commissions perçues ? Si oui quel est leur montant ?
    - Heures supplémentaires : Des heures supplémentaires ont-elles été effectuées ? Si oui combien ? et quel est leur montant si possible ?
    - Indemnités de congés payés : Y a-t-il eu des indemnités liées aux congés payés ? (Salaire perçu pendant les congés payés, mais pas l’indemnité compensatrice de congés payés.) Si oui quel est leur montant ?
    - Travail au forfait : Le travail est-il réalisé au forfait ? (ex : Forfait jours, Forfait heures)
    - Nombre d’heures travaillées : Combien d’heures ont été travaillées sur la période de paie ?
    - Absences rémunérées ou non rémunérées : Y a-t-il des absences (maladie, congés sans solde, etc.) et comment sont-elles valorisées ?
    - Congés payés : Combien de jours de congés payés acquis (non pris) ?
    - Autres retenues : Y a-t-il d’autres retenues (ex : mutuelle, avance sur salaire) ?
    - Statut du contrat : Le salarié est-il en CDI, CDD, intérim, ou autre ?
    - Nom du salarié : Comment s'appelle le salarié ? (si disponible)
    
    ### Format de réponse :
    Structure ta réponse sous cette forme:
    # [Période du bulletin de paie]
    - [Question]
    [Answer]
    `;
    // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    // const result = await model.generateContent({
    //   contents: [
    //     {
    //       role: "user", parts: [
    //         {text: prompt},
    //         {inlineData: {mimeType: "image/png", data: `${input.fileBase64}`}},
    //       ]
    //     }
    //   ]
    // });
    // const message = result.response.text();

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${input.fileBase64}` },
            }
          ],
        },
      ],
    });
    const message = gptResponse.choices[0].message.content;
    console.log('message:', message);
    return NextResponse.json({ message: message }, { status: 200 });
  } catch (error) {
    console.error("cannot analyse the BP:", error);
    return NextResponse.json({ message: 'Failed to analyse the BP' }, { status: 500 });
  }
}
