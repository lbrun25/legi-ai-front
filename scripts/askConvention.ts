import {searchArticlesInCollectiveAgreement} from "@/lib/supabase/agreements";
import dotenv from 'dotenv';
import OpenAI from "openai";

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const askAdvanceNotice = async (idcc: string) => {
  const query = "Quel est le délai de préavis prévu par la convention collective en cas de licenciement ?"
  const relevantArticles = await searchArticlesInCollectiveAgreement(idcc, query);
  const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
  console.log(relevantArticlesText);
  const prompt = `
Analysez rigoureusement le texte suivant d'une convention collective pour extraire les règles de préavis de licenciement.

# Texte à analyser:
${relevantArticlesText}

# Instructions:
1. Identifiez toutes les conditions de préavis en fonction de l'ancienneté
2. Détectez les exceptions et cas particuliers
3. Résolvez les contradictions selon cette priorité :
   a) Articles plus récents
   b) Mentions explicites "nonobstant"
   c) Calculs précis > mentions générales
4. Structurez les résultats en JSON selon ce schéma :

{
  "metadata": {
    "version_schema": "2.1",
    "idcc": "{idcc}",
    "date_analyse": "{current_date}",
    "confiance": 0-100 // estimation de la fiabilité
  },
  "preavis": [
    {
      "condition": "anciennete >= X", // en années
      "duree": {
        "valeur": Y,
        "unite": "months|days", // en anglais
        "formule": "optionnel si calcul complexe"
      },
      "references": [
        {
          "article": "Article 12.4",
          "extrait": "texte source pertinent"
        }
      ]
    }
  ],
  "exceptions": [
    {
      "declencheur": "description concise",
      "type": "reduction|augmentation|suspension",
      "impact": {
        "valeur_absolue": 15, // optionnel
        "valeur_relative": "-50%", // optionnel
        "nouvelle_duree": 1 // optionnel
      },
      "references": [] 
    }
  ],
  "default": {
    "duree": {
      "valeur": 1,
      "unite": "months"
    }
  },
  "validation": {
    "incoherences_detectees": [],
    "avertissements": [],
    "presuppositions": []
  }
}

# Règles strictes :
- Priorité aux valeurs numériques explicites
- Convertir toutes les durées en jours/mois/années
- Si unité absente : déduire selon le contexte (≥15 jours → mois)
- Si contradiction insoluble : ajouter une entrée dans "validation.incoherences_detectees"
- Si information manquante : utiliser "non_précisé" et réduire "confiance"

# Contrôles obligatoires :
1. Cohérence entre les seuils d'ancienneté
2. Vérification des chevauchements de plages
3. Détection de doublons
4. Validation des conversions d'unités

# En cas d'incertitude :
- Privilégier la mention "conditionnel" dans "validation.avertissements"
- Inclure les sources brutes dans "references"
- Maintenir les calculs séparés (ne pas pré-calculer)

Ne retournez QUE le JSON validé sans commentaires.
`;
  const extractionResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });
  return extractionResponse.choices[0].message.content?.trim();
}

const askSeniority = async (idcc: string) => {
  const query = "Quelle est la formule pour calculer l'indemnité de licenciement ?"
  const relevantArticles = await searchArticlesInCollectiveAgreement(idcc, query);
  const relevantArticlesText = relevantArticles.map(article => article.content).join('\n\n');
  console.log(relevantArticlesText);
  const prompt = `
  Quelle est la formule pour calculer l'indemnité de licenciement ? Retourne un format claire pour pouvoir parser la formule.
`;
  const extractionResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });
  return extractionResponse.choices[0].message.content?.trim();
}

const askConvention = async (idcc: string) => {
  const message = await askSeniority(idcc)
  console.log(message);
};

askConvention("2609");
