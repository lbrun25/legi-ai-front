import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  const input: {
    bpAnalysisResponse: string;
  } = await req.json();

  try {
    const prompt = `
Ton rôle est de calculer l'indemnité compensatrice de CP.
Deux méthodes sont possibles:
1. la méthode du dixième : indemnité = 10% du salaire brut de référence / nombre total de jours ouvrables de congés payés acquis sur la période X solde de jours ouvrables de congés payés acquis et non pris.
2. la méthode du maintien de salaire : l'indemnité est égale à la rémunération que le salarié aurait perçue s'il avait continué à travailler. Ce calcul peut être effectué en jours ouvrables ou en jours ouvrés.

### Bulletins de paie
Voici les derniers bulletins de paie qui te permettront de calculer l’indemnité de compensatrice de CP: ${input.bpAnalysisResponse}
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
