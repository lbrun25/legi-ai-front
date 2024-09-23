'use client'

import {Settings} from "lucide-react";
import * as React from "react";
import {Tooltip} from "@/components/tooltip";
import {useRouter} from "next/navigation";

export function SettingsButton() {
  const router = useRouter()

  return (
    <Tooltip text="Paramètres" position="left" buttonProps={{
      variant: "sideBarIcon",
      size: "sideBarIcon",
      onClick: () => router.push('/settings')
    }}>
      <Settings className="h-6 w-6"/>
      <span className="sr-only">Open settings</span>
    </Tooltip>
  )
}
