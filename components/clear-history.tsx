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
import {deleteMessages} from "@/lib/supabase/message";
import {Thread} from "@/lib/types/thread";

type ClearHistoryProps = {
  threads: Thread[];
  onHistoryCleaned: () => void;
}

export function ClearHistory({threads, onHistoryCleaned}: ClearHistoryProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={!threads?.length}>
          Supprimer l'historique
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action ne peut être annulée. Cette action supprimera définitivement
            votre historique et supprimera vos données de nos serveurs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={event => {
              event.preventDefault()
              startTransition(async () => {
                try {
                  await deleteThreads();
                  const deleteMessagesPromises = threads.map(thread => deleteMessages(thread.thread_id));
                  await Promise.all(deleteMessagesPromises);
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
            {isPending ? <Spinner/> : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
