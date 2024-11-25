import {NextResponse} from 'next/server';
import fs from 'fs/promises';
import OpenAI from "openai";
import path from 'path';
import {createReadStream} from 'fs';

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: Request) {
  const tempDir = '/tmp';
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ message: 'Unsupported files: Support only PDFs' }, { status: 400 });
    }
    console.log(`will upload file ${file.name}`);
    tempFilePath = path.join(tempDir, file.name);

    // Write file to temporary location
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(buffer));
    const stream = createReadStream(tempFilePath);
    const openAiFileResponse = await openai.files.create({
      file: stream,
      purpose: 'assistants',
    });

    return NextResponse.json({
      fileId: openAiFileResponse.id,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
