import {supabaseClient} from "@/lib/supabase/supabaseClient";
import {z} from "zod";

const routeContextSchema = z.object({
  params: z.object({
    number: z.string().min(1),
  }),
})

export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const { params } = routeContextSchema.parse(context)
    if (!process.env.ARTICLES_DB_NAME) {
      return new Response(null, { status: 500 })
    }
    const { data, error } = await supabaseClient
      .from(process.env.ARTICLES_DB_NAME)
      .select('content, url, source, number, context, startDate, endDate, isRepealed')
      .eq('number', params.number)
      .single();

    if (error) {
      return new Response(JSON.stringify({ error }), { status: 500 })
    }
    if (!data) {
      return new Response(null, { status: 404 })
    }
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.issues), { status: 422 })
    }
    return new Response(null, { status: 500 })
  }
}
