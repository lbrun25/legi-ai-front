"use client";
import {useAppState} from "@/lib/context/app-state";
import {BotIcon, FileIcon} from "lucide-react";
import React from "react";
import {SegmentedControl} from "@/components/segmented-controls";
import {MikeMode} from "@/lib/types/mode";

export const SelectMode = () => {
  const { selectedMode, setSelectedMode } = useAppState();

  return (
    <SegmentedControl
      name="select-mode"
      onSelected={(mode) => setSelectedMode(mode as MikeMode)}
      value={selectedMode}
      segments={[
        {
          label: "Recherche juridique",
          value: "research",
          icon: <BotIcon className="w-4 h-4"/>
        },
        {
          label: "Analyse",
          value: "analysis",
          icon: <FileIcon className="w-4 h-4"/>
        },
      ]}
    />
  );
}
