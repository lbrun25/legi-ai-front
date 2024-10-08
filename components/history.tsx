"use client"
import React, {useEffect, useTransition} from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { History as HistoryIcon } from 'lucide-react'
import { Suspense } from 'react'
import { HistorySkeleton } from './history-skelton'
import {Button} from "@/components/ui/button";

type HistoryProps = {
  children?: React.ReactNode
  open: boolean | null;
}

export function History({ children, open: openParams }: HistoryProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = React.useState(false);

  useEffect(() => {
    if (openParams !== null) {
      setOpen(openParams);
    }
  }, [openParams]);

  const onOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) {
      startTransition(() => {
        router.refresh()
      })
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetTrigger asChild>
        <Button variant="sidebar" size="sidebar">
          <HistoryIcon className="h-5 w-5" />
          <span className="font-semibold text-sm">{"Historique"}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-72 rounded-tl-xl rounded-bl-xl" side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1 text-sm font-medium mb-2">
            <HistoryIcon size={16} />
            {"Historique"}
          </SheetTitle>
        </SheetHeader>
        <div className="my-2 h-full pb-12 md:pb-10">
          <Suspense fallback={<HistorySkeleton />}>{children}</Suspense>
        </div>
      </SheetContent>
    </Sheet>
  )
}
