"use client"
import {useState, useTransition} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {toast} from 'sonner'
import {Spinner} from './ui/spinner'
import {deleteThreads} from "@/lib/supabase/threads";
import {PostgrestError} from "@supabase/supabase-js";

type ClearHistoryProps = {
  empty: boolean
  onHistoryCleaned: () => void;
}

export function ClearHistory({empty, onHistoryCleaned}: ClearHistoryProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={empty}>
          Clear History
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            history and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={event => {
              event.preventDefault()
              startTransition(async () => {
                try {
                  await deleteThreads();
                  onHistoryCleaned();
                  toast.success('History cleared');
                } catch (error) {
                  console.error("cannot delete threads:", error);
                  toast.error((error as PostgrestError).message);
                }
                setOpen(false);
              })
            }}
          >
            {isPending ? <Spinner/> : 'Clear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
