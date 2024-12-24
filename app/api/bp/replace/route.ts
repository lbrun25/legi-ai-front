import {NextResponse} from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    bpFields: Record<string, { brut?: string; period?: string; natureAdvantage?: string }>;
    bpAnalysisResponse: string;
    employeeName: string;
    entryDate: string;
    earnedPaidLeave: string;
  } = await req.json();

  try {
    const prompt = `
### Objectif
Tu es un assistant spécialisé dans l'édition et la mise à jour des informations contenues dans un texte de bulletins de paie.

### Contenu Original :
Voici le contenu original extrait des bulletins de paie :
${input.bpAnalysisResponse}

### Mises à jour demandées :
Les informations suivantes doivent remplacer (uniquement si spécifié) les valeurs existantes dans le texte ci-dessus :

- **Nom du salarié :** ${input.employeeName || 'Non spécifié'}
- **Date d'entrée :** ${input.entryDate || 'Non spécifiée'}
- **Nombre de congés payés acquis à date :** ${input.earnedPaidLeave || 'Non spécifié'}

### Champs individuels à mettre à jour (uniquement si spécifié) :
${Object.entries(input.bpFields)
      .map(([key, { brut, period, natureAdvantage }]) => `- **${key}** : Salaire brut: ${brut || 'Non spécifié'}, Période: ${period || 'Non spécifiée'}, Avantage nature: ${natureAdvantage || 'Non spécifiée'}`)
      .join('\n')}

### Instructions Importantes :
1. Remplace chaque valeur existante dans le texte par les nouvelles valeurs fournies ci-dessus.
2. Conserve la structure et le format d'origine du texte.
3. Si une valeur est marquée comme "Non spécifiée", conserve la valeur existante dans le texte.
4. Ne modifie **aucune autre partie du texte** en dehors des champs indiqués.

### Format attendu :
Retourne uniquement le texte mis à jour, sans ajout de texte explicatif, ni de balises Markdown.
\`\`\`
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
    const message = gptResponse.choices[0].message;
    console.log('message:', message);
    return NextResponse.json(
      { message: message.content },
      { status: 200 }
    );
  } catch (error) {
    console.error("cannot replace BPs info:", error);
    return NextResponse.json({ message: 'Failed to replace BPs info' }, { status: 500 });
  }
}
