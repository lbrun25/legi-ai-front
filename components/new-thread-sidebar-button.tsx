"use client";
import {SquarePen} from "lucide-react";
import React from "react";
import {Button} from "@/components/ui/button";

export const NewThreadSidebarButton = () => {
  return (
    <Button
      variant="sidebar"
      size="sidebar"
      onClick={() => window.location.href = '/'}
    >
      <SquarePen className="h-5 w-5"/>
      <span className="font-semibold text-sm">{"Nouvelle discussion"}</span>
    </Button>
  );
}
