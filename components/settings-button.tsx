'use client'

import {Settings} from "lucide-react";
import * as React from "react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Tooltip} from "@/components/tooltip";

export function SettingsButton() {
  return (
    <Tooltip text="Paramètres" position="left">
      <Button variant="sidebarIcon" size="sidebarIcon">
        <Link
          href={"/settings"}
          className="flex items-center"
        >
          <Settings className="h-7 w-7"/>
          <span className="sr-only">Open settings</span>
        </Link>
      </Button>
    </Tooltip>
  )
}
