"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ModeToggle } from "./mode-toggle";
import { SettingsButton } from "@/components/settings-button";
import { TimeSaved } from "@/components/time-saved";

interface RightSidebarProps {
  isSuperAdmin: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isSuperAdmin }) => {
  const pathname = usePathname();

  if (pathname.startsWith("/bp")) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 h-screen bg-blue-500 bg-gradient-to-b from-pink-50 via-blue-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 w-60">
      <div className="mt-2 gap-2 px-8 flex flex-col items-center">
        <ModeToggle />
        {isSuperAdmin && (
          <SettingsButton />
        )}
        <div className="mt-8">
          <TimeSaved />
        </div>
      </div>
    </div>
  );
};
