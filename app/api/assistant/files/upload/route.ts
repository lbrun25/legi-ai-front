import { NextResponse } from 'next/server';
import fs from 'fs';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    // Save the file temporarily to upload with OpenAI API
    const tempFilePath = `/tmp/${file.name}`;
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // Upload to OpenAI
    const response = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    // Return the OpenAI file ID
    return NextResponse.json(response);
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
