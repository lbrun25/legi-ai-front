"use client";
import {ScrollIcon} from "lucide-react";
import React from "react";
import {Button} from "@/components/ui/button";

export const BpAnalyzerSidebarButton = () => {
  return (
    <Button
      variant="sidebar"
      size="sidebar"
      onClick={() => window.location.href = '/bp'}
    >
      <ScrollIcon className="h-5 w-5"/>
      <span className="font-semibold text-sm">{"Calcul indemnités"}</span>
    </Button>
  );
}
