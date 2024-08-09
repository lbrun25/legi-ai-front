import {NextRequest} from "next/server";
import {supabaseClient} from "@/lib/supabase/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    const articleSource = req.nextUrl.searchParams.get("source");
    if (!articleSource) {
      return new Response(JSON.stringify({error: "Missing article source"}), {status: 400});
    }
    const articleNumber = req.nextUrl.searchParams.get("number");
    if (!articleNumber) {
      return new Response(JSON.stringify({error: "Missing article number"}), {status: 400});
    }

    if (!process.env.ARTICLES_DB_NAME) {
      return new Response(null, {status: 500})
    }
    console.log('number:', articleNumber);
    console.log('source:', articleSource);
    const {data, error} = await supabaseClient
      .from(process.env.ARTICLES_DB_NAME)
      .select('content, url, source, number, context, startDate, endDate, isRepealed')
      .eq('number', articleNumber)
      .eq('source', articleSource)
      .single();

    if (error) {
      console.error('Error retrieving article from Supabase:', error);
      return new Response(JSON.stringify({error}), {status: 500})
    }
    if (!data) {
      return new Response(null, {status: 404})
    }
    return new Response(JSON.stringify(data), {status: 200})
  } catch (error) {
    console.error('Error retrieving article:', error);
    return new Response(null, {status: 500})
  }
}
