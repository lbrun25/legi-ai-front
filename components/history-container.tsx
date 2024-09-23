"use client"
import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

const HistoryContainer = () => {
  const [open, setOpen] = React.useState<boolean | null>(null);
  return (
    <div>
      <History open={open}>
        <HistoryList onHistoryCleaned={() => setOpen(false)} />
      </History>
    </div>
  )
}

export default HistoryContainer
