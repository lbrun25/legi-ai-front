import { NextRequest, NextResponse } from "next/server";
import { ElasticsearchClient } from "@/lib/elasticsearch/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    const suggestions = await ElasticsearchClient.searchTitleSuggestions(query);
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("Error in suggestions API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions", details: error.message },
      { status: 500 }
    );
  }
}
