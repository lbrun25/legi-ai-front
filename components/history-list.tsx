import React, {cache} from 'react'
import HistoryItem from './history-item'
import {ClearHistory} from './clear-history'
import {getThreads} from "@/lib/supabase/threads";

const loadThreads = cache(async () => {
  return await getThreads()
})

export async function HistoryList() {
  const threads = await loadThreads();

  return (
    <div className="flex flex-col flex-1 space-y-3 h-full">
      <div className="flex flex-col space-y-0.5 flex-1 overflow-y-auto">
        {!threads?.length ? (
          <div className="text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        ) : (
          threads?.map(
            (thread) => thread && <HistoryItem key={thread.thread_id} thread={thread}/>
          )
        )}
      </div>
      <div className="mt-auto">
        <ClearHistory empty={!threads?.length}/>
      </div>
    </div>
  )
}
