import {createClient} from "@/lib/supabase/client/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(null, { status: 403 });
    }
    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error retrieving threads:', error);
      return new Response(null, { status: 500 })
    }
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (error) {
    return new Response(null, { status: 500 })
  }
}
