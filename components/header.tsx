"use server"
import React from 'react'
import { ModeToggle } from './mode-toggle'
import {SettingsButton} from "@/components/settings-button";
import {createClient} from "@/lib/supabase/client/server";
import HistoryContainer from "@/components/history-container";
import {SquarePen} from 'lucide-react'
import {Button} from "@/components/ui/button";
import {Tooltip} from "@/components/tooltip";
import Link from "next/link";

export const Header: React.FC = async () => {
  const supabase = createClient()

  const { data, error } = await supabase.auth.getUser()

  return (
    <>
      <div className="w-full flex justify-center mt-2">
        <span className="text-4xl font-montserrat font-bold">{"mike."}</span>
      </div>
      <header
        className="fixed w-full p-1 md:p-2 flex justify-between items-center z-10 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent top-0"
      >
        <div className="fixed left-0 top-0 h-screen w-32 bg-gradient-to-b from-pink-50 via-blue-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950">
          <div className="mt-2 gap-2 px-8 flex flex-col items-center">
            <HistoryContainer location="header"/>
            <Tooltip text="Nouvelle conversation" position="right">
              <Button variant="sidebarIcon" size="sidebarIcon">
                <Link href="/">
                  <SquarePen className="h-7 w-7"/>
                </Link>
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="fixed right-0 top-0 h-screen flex flex-row gap-2 bg-blue-500 px-12 bg-gradient-to-b from-pink-50 via-blue-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950">
          <div className="mt-2 gap-2 px-8 flex flex-col items-center">
            <ModeToggle/>
            {(!error && data?.user?.app_metadata?.role === "super-admin") && (
              <SettingsButton/>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

export default Header
