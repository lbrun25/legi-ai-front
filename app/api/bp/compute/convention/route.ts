import {GoogleGenerativeAI} from "@google/generative-ai";
import {NextResponse} from "next/server";
import fs from 'fs';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bpAnalysisResponse = formData.get('bpAnalysisResponse');
    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }
    console.log('file.name:', file.name)
    const tempFilePath = `/tmp/${file.name}`;
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // Load the PDF using PDFLoader
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();
    const conventionContent = docs.map(doc => doc.pageContent).join('\n');

    const prompt = `
    Calcul l’indemnité de licenciement en te basant sur les derniers bulletins de paie et sur la collection collective puis effectue une double vérification de tes calculs.
    
    # Règle de calcul:
    Utilise toujours un interpréteur Python pour effectuer chacun de tes calculs dans ton raisonnement.
    
    # Bulletins de paie
    Voici les derniers bulletins de paie du salarié:
    ${bpAnalysisResponse}
    
    # Collection collective
    Voici la convention collective pour calculer l’indemnité de licenciement du salarié: 
    ${conventionContent}
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
    console.error("cannot compute indemnities with convention:", error);
    return NextResponse.json({ message: 'Failed to compute indemnities with convention' }, { status: 500 });
  }
}
