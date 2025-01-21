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
  } = await req.json();

  try {
    const prompt = `
# Objectif :
Ton rôle est de calculer le salaire brute de référence d'après le calcul légal.

# Règle de calcul:
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.
- Effectue une double vérification de tes calculs.

# Déterminer le salaire brute de référence
Le Salaire Brute de Référence correspond au montant le plus élevé entre :
- La moyenne mensuelle des 12 derniers mois précédant la rupture du contrat
OU
- Le tiers des 3 derniers mois, en ajoutant 1/12ème des primes annuelles à chaque mois si applicable

## Explication du tiers des 3 derniers mois:
1. Additionner les Salaires Bruts des 3 Derniers Mois :
• Calculez la somme des salaires bruts perçus au cours des trois derniers mois précédant le licenciement.
2. Ajouter 1/12ème des Primes Annuelles :
• Si le salarié a reçu une prime annuelle, ajoutez 1/12ème de cette prime à chacun des trois mois concernés.
3. Calculer le Tiers de la Somme Totale :
• Divisez la somme totale obtenue (salaires bruts + parts de primes) par trois pour obtenir le salaire de référence.

**Exemple Concret**
Supposons qu'un salarié ait perçu les salaires suivants au cours des trois derniers mois :
- Mois 1 : 2 000 €
- Mois 2 : 2 100 €
- Mois 3 : 2 050 €

Et qu'il ait reçu une prime annuelle de 1 200 €.

**Calcul**
1. **Ajouter la Part Mensuelle de la Prime Annuelle :**
    Part mensuelle de la prime = 1 200 / 12 = 100
2. **Calculer les Salaires Ajustés :**
    - Mois 1 : 2 000 + 100 = 2 100
    - Mois 2 : 2 100 + 100 = 2 200
    - Mois 3 : 2 050 + 100 = 2 150
3. **Somme Totale des Salaires Ajustés :**
    Total = 2 100 + 2 200 + 2 150 = 6 450
4. **Calculer le Tiers :**
    Salaire de référence = 6 450 / 3 = 2 150

Ainsi, le salaire de référence pour ce salarié serait de 2 150 € par mois selon cette méthode.
Cette méthode peut être plus avantageuse si les salaires ou primes récents sont plus élevés que ceux des mois précédents.
En résumé, cet exemple illustre le calcul d'un salaire de référence en tenant compte d'une prime annuelle. On divise la prime annuelle par 12 pour obtenir un montant mensuel, que l'on ajoute ensuite à chaque salaire mensuel des trois derniers mois. On additionne ensuite ces salaires ajustés et on divise le total par 3 pour obtenir le salaire de référence. Il est noté que cette méthode est plus avantageuse si les salaires récents sont plus élevés.

## Explication du salaire de référence
Le salaire de référence est composé :
1. **Salaire de Base**
• Le salaire mensuel fixe établi par le contrat de travail.
2. **Primes et Gratifications**
• Primes annuelles (ex. prime de fin d’année, treizième mois) : elles doivent être réparties sur les mois concernés.
• Primes exceptionnelles : proportionnées sur la période de référence.
• Primes liées à la performance, telles que les primes d’objectif ou de résultat.
3. **Commissions**
• Les commissions perçues pendant la période de référence, qui sont souvent basées sur les ventes ou la performance.
4. **Heures Supplémentaires**
• Rémunération des heures supplémentaires effectuées.
5. **Avantages en Nature**
• Valeur des avantages en nature (ex. voiture de fonction, logement).
Exemple:
Un salarié a travaillé 3 ans à temps plein, puis 2 ans à mi-temps. Son salaire brut moyen pendant les 12 derniers mois à mi-temps est de 1 000 € (soit 2 000 € à temps plein). Le calcul de l'indemnité est le suivant  : (2000 x (1/4) x 3) + (1000 x (1/4) x 2) = 2 000 €.

## Cas particulier en arrêt de travail
Lorsque le salarié a été en arrêt de travail pour maladie au cours des derniers mois, le salaire de référence à prendre en compte est celui des 12 ou des 3 derniers mois précédant l'arrêt.

# Données disponibles :  
- Derniers bulletins de paie :
\`\`\`
${input.bpAnalysisResponse}
\`\`\`

# Réponse attendue :
- Tu dois afficher uniquement cette réponse à l'utilisateur :
"Calcul du salaire de référence 🤑: 

Méthode 12 derniers mois : XXX + XXX + XXX + …. XXX = [montant du salaire de référence 1].
Méthode 3 derniers mois : XXXX + XXXX + XXXX = [montant du salaire de référence 2].
Le [montant salaire de référence 1] est plus favorable car [montant du salaire de référence 1] > [montant du salaire de référence 2]. Nous allons retenir celui-ci pour la suite des calculs."
`;
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    const message = response.choices[0].message.content?.trim()
    console.log('message:', message);

    // 🔹 Second LLM Call: Extract Only the Value in "X mois" Format
    const extractionPrompt = `
Objectif :
À partir du texte suivant, extrait uniquement le montant du salaire de référence le plus favorable. N'inclus aucun autre texte ou explication.

Texte :  
"${message}"

Réponse attendue :  
Retourne uniquement le montant du salaire de référence le plus favorable avec le symbole de la monnaie.
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
    console.error("cannot compute legal reference salary:", error);
    return NextResponse.json({ message: 'Failed to compute legal reference salary' }, { status: 500 });
  }
}
