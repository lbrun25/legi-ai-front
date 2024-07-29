'use client'

import React, {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {cn} from '@/lib/utils'
import {Thread} from "@/lib/types/thread";
import {HistorySettingsMenu} from "@/components/history-settings-menu";
import {Flag} from "lucide-react";

type HistoryItemProps = {
  thread: Thread
}

const formatDateWithTime = (date: Date | string) => {
  const parsedDate = new Date(date)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  if (
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${formatTime(parsedDate)}`
  } else if (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${formatTime(parsedDate)}`
  } else {
    return parsedDate.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
}

const HistoryItem: React.FC<HistoryItemProps> = ({thread}) => {
  const pathname = usePathname();
  const isActive = pathname === `/${thread.thread_id}`;
  const [isHovered, setIsHovered] = useState(false);
  const [isReported, setIsReported] = useState(() => {
    const isReportedLocalStorage = localStorage.getItem(`isReported_${thread.thread_id}`);
    return isReportedLocalStorage ? JSON.parse(isReportedLocalStorage) : false;
  });

  useEffect(() => {
    localStorage.setItem(`isReported_${thread.thread_id}`, JSON.stringify(isReported));
  }, [isReported, thread.thread_id]);

  return (
    <Link
      href={`/c/${thread.thread_id}`}
      className={cn(
        'flex flex-col hover:bg-muted cursor-pointer p-2 rounded border',
        isActive ? 'bg-muted/70 border-border' : 'border-transparent'
      )}
      onMouseEnter={() => setIsHovered(true)}
    >
      <div className="flex flex-row justify-between">
        <div className="flex flex-col justify-center">
          <div className="flex flex-row">
            {isReported && (
              <div className="flex items-center">
                <Flag className="text-red-500 h-4 w-4 mr-3"/>
              </div>
            )}
            <div className="flex flex-col">
              <div className="text-xs font-medium truncate select-none">
                {thread.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {thread.created_at && formatDateWithTime(thread.created_at)}
              </div>
            </div>
          </div>
        </div>
        {isHovered && (
          <div className="justify-between">
            <HistorySettingsMenu
              onReportClicked={() => setIsReported(!isReported)}
              isReported={isReported}
              onOpenChanged={(isOpen) => {
                if (isHovered && !isOpen) {
                  setIsHovered(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </Link>
  )
}

export default HistoryItem
