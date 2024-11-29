// Partitioning the document using Unstructured API
import {Strategy} from "unstructured-client/sdk/models/shared";
import {unstructuredClient} from "@/lib/unstructured/client";
import {NextResponse} from "next/server";
import {UnstructuredTableElement} from "@/lib/types/table";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// Returns table and image elements
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }
    const fileBuffer = await file.arrayBuffer();
    const partitionParameters = {
      files: {
        content: new Blob([fileBuffer]),
        fileName: file.name,
      },
      strategy: Strategy.HiRes,
      splitPdfPage: true,
      splitPdfAllowFailed: true,
      splitPdfConcurrencyLevel: 15,
      languages: ['fr']
    };
    const unstructuredApiResponse = await unstructuredClient.general.partition({ partitionParameters });
    if (unstructuredApiResponse.statusCode === 200) {
      if (!unstructuredApiResponse.elements) {
        console.error("Unstructured did not find elements");
        return NextResponse.json({ message: 'Unstructured did not find elements' }, { status: 500 });
      }
      const tables = unstructuredApiResponse.elements?.map(element => {
        if (element?.type === "Table" && element?.metadata && element?.text) {
          const response: UnstructuredTableElement = {
            text: element.text,
            html: element.metadata?.text_as_html,
            filetype: element.metadata?.filetype,
            pageNumber: element.metadata?.pageNumber,
            filename: element.metadata?.filename,
          }
          return response;
        }
        return null;
      }).filter(table => table !== null);
      return NextResponse.json({tables});
    }
    return NextResponse.json({ message: 'Unstructured did not response successfully' }, { status: unstructuredApiResponse.statusCode });
  } catch (error) {
    console.error("cannot make partition with unstructured:", error);
  }
}
