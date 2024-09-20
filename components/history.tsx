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
import { Button } from '@/components/ui/button'
import {ChevronRight} from 'lucide-react'
import { cn } from '@/lib/utils'
import { History as HistoryIcon } from 'lucide-react'
import { Suspense } from 'react'
import { HistorySkeleton } from './history-skelton'
import {Tooltip} from "@/components/tooltip";

type HistoryProps = {
  location: 'sidebar' | 'header'
  children?: React.ReactNode
  open: boolean | null;
}

export function History({ location, children, open: openParams }: HistoryProps) {
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
        <Tooltip text="Historique" position="right">
          <Button
            variant="sidebarIcon"
            size="sidebarIcon"
            className={cn({
              'rounded-full text-foreground/30': location === 'sidebar'
            })}
          >
            {location === 'header' ? <HistoryIcon className="h-7 w-7" /> : <ChevronRight size={16} />}
          </Button>
        </Tooltip>
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
