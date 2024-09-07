"use client"
import React, {cache, useEffect, useState} from 'react'
import HistoryItem from './history-item'
import {ClearHistory} from './clear-history'
import {getThreads} from "@/lib/supabase/threads";
import {Thread} from "@/lib/types/thread";
import {toast} from 'sonner'
import {PostgrestError} from "@supabase/supabase-js";
import {HistorySkeleton} from "@/components/history-skelton";

const loadThreads = cache(async () => {
  return await getThreads()
})

interface HistoryListProps {
  onHistoryCleaned: () => void;
}

export function HistoryList({onHistoryCleaned}: HistoryListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        setLoading(true);
        const loadedThreads = await loadThreads();
        setThreads(loadedThreads);
      } catch (error) {
        toast.error((error as PostgrestError).message);
      } finally {
        setLoading(false);
      }
    };
    fetchThreads();
  }, []);

  return (
    <div className="flex flex-col flex-1 space-y-3 h-full">
      <div className="flex flex-col space-y-0.5 flex-1 overflow-y-auto">
        {loading && (
          <HistorySkeleton />
        )}
        {(!loading && !threads?.length) && (
          <div className="text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        )}
        {(!loading && threads.length > 0) && (
          threads?.map(
            (thread) => thread && <HistoryItem key={thread.thread_id} thread={thread}/>
          )
        )}
      </div>
      <div className="mt-auto">
        <ClearHistory threads={threads} onHistoryCleaned={() => onHistoryCleaned()} />
      </div>
    </div>
  )
}
