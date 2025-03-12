import {NextResponse} from 'next/server';
import {checkFileExists, uploadFileToGCS} from "@/lib/google/storage";
import {getUserId} from "@/lib/supabase/utils";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    const userId = await getUserId();
    const filename = `${userId}_${file.name}`;
    const alreadyExists = await checkFileExists(filename);
    if (alreadyExists) {
      return NextResponse.json({ message: "File already exists" }, { status: 200 });
    }
    const gcsPath = await uploadFileToGCS(file, filename);

    return NextResponse.json({ message: "Upload successful", gcsPath }, { status: 200 });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
  }
}
