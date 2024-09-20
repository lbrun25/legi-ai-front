"use server"
import HistoryContainer from './history-container'
import {createClient} from "@/lib/supabase/client/server";

export async function Sidebar() {
  const supabase = createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return null;
  }

  return (
    <div className="h-screen p-2 fixed top-0 left-0 flex-col justify-center pb-24 hidden sm:flex">
      <HistoryContainer />
    </div>
  )
}
