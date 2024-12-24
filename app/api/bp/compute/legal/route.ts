import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  const input: {
    bpAnalysisResponse: string;
  } = await req.json();

  try {
    const prompt = `
Ton rôle est de calculer l’indemnité de licenciement par le "calcul légal". D'abord tu dois 1. déterminer le salaire brute de référence, 2. calcule l'indemnité légale 3. Effectue une double vérification de tes calculs.
    
# Règle de calcul:
Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.

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
6. **Indemnités de Congés Payés**
• Salaire perçu pendant les congés payés, mais pas l’indemnité compensatrice de congés payés.
Si le salarié a travaillé à temps complet avant de passer à temps partiel (ou inversement), l'indemnité est calculée **proportionnellement** à la durée de chaque période.
Exemple:
Un salarié a travaillé 3 ans à temps plein, puis 2 ans à mi-temps. Son salaire brut moyen pendant les 12 derniers mois à mi-temps est de 1 000 € (soit 2 000 € à temps plein). Le calcul de l'indemnité est le suivant  : (2000 x (1/4) x 3) + (1000 x (1/4) x 2) = 2 000 €.

## Cas particulier en arrêt de travail
Lorsque le salarié a été en arrêt de travail pour maladie au cours des derniers mois, le salaire de référence à prendre en compte est celui des 12 ou des 3 derniers mois précédant l'arrêt.

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
 
# Bulletins de paie
Voici les derniers bulletins de paie qui te permettront de calculer l’indemnité de licenciement par le "calcul légal":\n${input.bpAnalysisResponse}
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
    return NextResponse.json({ message: message }, { status: 200 });
  } catch (error) {
    console.error("cannot compute legal indemnities:", error);
    return NextResponse.json({ message: 'Failed to compute legal indemnities' }, { status: 500 });
  }
}
