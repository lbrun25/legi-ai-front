"use client";
import {Tooltip} from "@/components/tooltip";
import {SquarePen} from "lucide-react";
import React from "react";

export const NewThreadSidebarButton = () => {
  return (
    <Tooltip
      text="Nouvelle conversation"
      position="right"
      buttonProps={{
        variant: "sidebar",
        size: "sideBarIcon",
        onClick: () => window.location.href = '/'
      }}
    >
      <SquarePen className="h-7 w-7"/>
    </Tooltip>
  );
}
