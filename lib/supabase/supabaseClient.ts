import {createClient} from "@supabase/supabase-js";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const supabaseServiceRoleKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;

export const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {persistSession: false},
});
