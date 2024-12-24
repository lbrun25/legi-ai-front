// import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
import OpenAI from "openai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const input: {
    checkedResponse: string;
  } = await req.json();

  try {
    const prompt = `
### Contexte :
Entre l'indemnité légale et celle de la convention collective, quelle est la plus favorable ? Réponds en indiquant la plus favorable et donne le montant de l'indemnité de licenciement.

### Données :
${input.checkedResponse}

### Instructions de Réponse :
- Réponds **STRICTEMENT** en JSON brut.
- N'ajoute **aucun texte supplémentaire** avant ou après le JSON.
- **Pas de balises Markdown (\`\`\`json)** ni de commentaires.
- Le montant de \`severance_pay\` doit inclure le symbole de la monnaie (par exemple : "3000 €").

### Format attendu :
{
  "severance_pay": "<montant de l'indemnité avec symbole de la monnaie>"
}
`;
    // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    // const result = await model.generateContent({
    //   contents: [
    //     {
    //       role: "user", parts: [
    //         {text: prompt},
    //       ]
    //     }
    //   ]
    // });
    // const message = result.response.text();
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
    const jsonResponse = JSON.parse(message || "{}");
    return NextResponse.json({ severancePay: jsonResponse.severance_pay }, { status: 200 });
  } catch (error) {
    console.error("cannot compute legal indemnities:", error);
    return NextResponse.json({ message: 'Failed to compute legal indemnities' }, { status: 500 });
  }
}
