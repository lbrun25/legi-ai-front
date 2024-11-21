import {NextResponse} from "next/server";
import {checkUserDocumentTable} from "@/lib/supabase/documents";
import {ElasticsearchClient} from "@/lib/elasticsearch/client";

export async function POST(req: Request) {
  try {
    const tableName = await checkUserDocumentTable();
    const esIndexName = await ElasticsearchClient.checkUserDocumentIndex();
    return NextResponse.json({
      supabaseTableName: tableName,
      esIndexName: esIndexName,
    });
  } catch (error) {
    console.log("cannot ingest document chunks:", error);
    return NextResponse.json({ message: 'Failed to ingest documents' }, { status: 500 });
  }
}
