import {NextRequest, NextResponse} from "next/server";
import OpenAI, {toFile} from "openai";

export async function POST(req: NextRequest) {
  const input: {
    audioData: string;
  } = await req.json();
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const audioBuffer = Buffer.from(input.audioData, "base64");
    const file = await toFile(audioBuffer, "audio.wav");

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: "fr",
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });
    console.debug('received transcription response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({message: 'Failed to transcribe audio'}, {status: 500});
  }
}
