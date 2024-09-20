"use client";
import {Tooltip} from "@/components/tooltip";
import {SquarePen} from "lucide-react";
import React from "react";
import {useRouter} from "next/navigation";

export const NewThreadSidebarButton = () => {
  const router = useRouter()

  return (
    <Tooltip
      text="Nouvelle conversation"
      position="right"
      buttonProps={{
        variant: "sidebar",
        size: "sideBarIcon",
        onClick: () => router.push('/')
      }}
    >
      <SquarePen className="h-7 w-7"/>
    </Tooltip>
  );
}
