"use server"
import React from 'react'
import { ModeToggle } from './mode-toggle'
import {SettingsButton} from "@/components/settings-button";
import {createClient} from "@/lib/supabase/client/server";
import HistoryContainer from "@/components/history-container";
import {NewThreadSidebarButton} from "@/components/new-thread-sidebar-button";
import {VideoMike} from "@/components/video-mike";
import {TimeSaved} from "@/components/time-saved";
import {HelpSidebarButton} from "@/components/help-sidebar-button";

export const Header: React.FC = async () => {
  const supabase = createClient()

  const { data, error } = await supabase.auth.getUser()

  return (
    <>
      <div className="fixed w-full flex justify-center items-center pt-4 pb-14 flex-row space-x-4 z-40 bg-gradient-to-b from-white from-50% to-white/20 dark:from-black dark:to-dark/20">
        <VideoMike/>
        <span className="text-4xl font-montserrat font-bold">mike.</span>
        <div className="bg-gray-200/50 backdrop-blur-2xl text-gray-900 text-[11px] font-semibold px-2 py-1 rounded-full">
          {"Accès prioritaire"}
        </div>
      </div>
      <header
        className="fixed w-full p-1 md:p-2 flex justify-between items-center z-50 backdrop-blur md:backdrop-blur-none bg-background/80 md:bg-transparent top-0"
      >
        <div
          className="fixed left-0 top-0 h-screen bg-gradient-to-b from-pink-50 via-blue-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 w-60">
          <div className="mt-6 flex flex-col w-full">
            <HistoryContainer/>
            <NewThreadSidebarButton/>
            <HelpSidebarButton/>
          </div>
        </div>
        <div
          className="fixed right-0 top-0 h-screen bg-blue-500 bg-gradient-to-b from-pink-50 via-blue-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 w-60">
          <div className="mt-2 gap-2 px-8 flex flex-col items-center">
            <ModeToggle/>
            {(!error && data?.user?.app_metadata?.role === "super-admin") && (
              <SettingsButton/>
            )}
            <div className="mt-8">
              <TimeSaved />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header
