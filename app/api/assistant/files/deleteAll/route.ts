import {NextResponse} from "next/server";
import {deleteDocuments} from "@/lib/supabase/documents";

export async function DELETE(req: Request) {
  try {
    await deleteDocuments();
    return NextResponse.json({message: "User documents deleted"});
  } catch (error) {
    console.error('cannot delete user documents:', error);
    return NextResponse.json({ message: 'Failed to delete user documents' }, { status: 500 });
  }
}
