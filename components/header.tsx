import React from 'react'
import { ModeToggle } from './mode-toggle'
import { IconLogo } from './ui/icons'
import { cn } from '@/lib/utils'
import HistoryContainer from './history-container'
import {SettingsButton} from "@/components/settings-button";

export const Header: React.FC = async () => {
  return (
    <header className="fixed w-full p-1 md:p-2 flex justify-between items-center z-10 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent">
      <div>
        <a href="/">
          <IconLogo className={cn('w-5 h-5')} />
          <span className="sr-only">Legal AI</span>
        </a>
      </div>
      <div className="flex gap-0.5">
        <div className="flex flex-row gap-2">
          <SettingsButton />
          <ModeToggle />
        </div>
        <HistoryContainer location="header" />
      </div>
    </header>
  )
}

export default Header
