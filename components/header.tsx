"use server"
import React from 'react'
import { ModeToggle } from './mode-toggle'
import {SettingsButton} from "@/components/settings-button";
import {createClient} from "@/lib/supabase/client/server";
import HistoryContainer from "@/components/history-container";
import {SquarePen} from 'lucide-react'
import {Button} from "@/components/ui/button";
import Link from "next/link";

export const Header: React.FC = async () => {
  const supabase = createClient()

  const { data, error } = await supabase.auth.getUser()

  return (
    <header className="fixed w-full p-1 md:p-2 flex justify-between items-center z-10 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent">
      <div className="flex flex-row items-center">
        <HistoryContainer location="header" />
        <Button
          variant="ghost"
          size="icon"
        >
          <Link href="/">
            <SquarePen className="h-[1.2rem] w-[1.2rem]"/>
          </Link>
        </Button>
      </div>
      <div className="flex gap-0.5">
        <div className="flex flex-row gap-2">
          {(!error && data?.user?.app_metadata?.role === "super-admin") && (
            <SettingsButton/>
          )}
          <ModeToggle/>
        </div>
      </div>
    </header>
  )
}

export default Header
