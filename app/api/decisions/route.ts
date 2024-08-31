import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {NextRequest} from "next/server";

export async function GET(req: NextRequest) {
  try {
    const decisionNumber = req.nextUrl.searchParams.get("number");
    if (!decisionNumber) {
      return new Response(JSON.stringify({error: "Missing decision number"}), {status: 400});
    }
    const { data, error } = await supabaseClient
      .from("LegalDecisions")
      .select('number, date, juridiction, ficheArret, decisionContent, decisionLink')
      .eq('number', decisionNumber)
      .single();

    if (error) {
      console.error('Error retrieving decision from Supabase:', error);
      return new Response(JSON.stringify({ error }), { status: 500 })
    }
    if (!data) {
      return new Response(null, { status: 404 })
    }
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (error) {
    console.error('Error retrieving decision:', error);
    return new Response(null, { status: 500 })
  }
}
