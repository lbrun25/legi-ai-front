import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  const input: {
    legalIndemnitiesResponse: string;
    conventionIndemnitiesResponse: string;
  } = await req.json();

  try {
    const prompt = `
Ton rôle est de vérifier et corriger les calculs de l’indemnité de licenciement selon :
1. Le calcul légal  
2. Le calcul de la convention collective  

### Règles à suivre :  
- Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.
- Indique le montant final (corrigé si nécessaire) obtenu pour chaque méthode après vérification.  
- Explique les éventuelles différences entre les deux calculs si elles existent.  

### Calcul légal :  
${input.legalIndemnitiesResponse}

### Calcul de la convention collective :  
${input.conventionIndemnitiesResponse}
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
