import {NextResponse} from "next/server";
import {deleteDocuments} from "@/lib/supabase/documents";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";

export async function DELETE(req: Request) {
  try {
    // Delete supabase items
    await deleteDocuments();

    // Delete ES items
    const indexName = await ElasticsearchClient.getUserDocumentIndexName();
    await ElasticsearchClient.deleteAllDataInIndex(indexName)

    return NextResponse.json({message: "User documents deleted"});
  } catch (error) {
    console.error('cannot delete user documents:', error);
    return NextResponse.json({ message: 'Failed to delete user documents' }, { status: 500 });
  }
}
