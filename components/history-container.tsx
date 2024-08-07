"use client"
import React from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

type HistoryContainerProps = {
  location: 'sidebar' | 'header'
}

const HistoryContainer: React.FC<HistoryContainerProps> = ({
  location
}) => {
  const [open, setOpen] = React.useState<boolean | null>(null);
  return (
    <div>
      <History location={location} open={open}>
        <HistoryList onHistoryCleaned={() => setOpen(false)} />
      </History>
    </div>
  )
}

export default HistoryContainer
