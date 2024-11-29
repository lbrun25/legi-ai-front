"use client";
import {useAppState} from "@/lib/context/app-state";
import {BotIcon, FileIcon, FileSearchIcon} from "lucide-react";
import React from "react";
import {SegmentedControl} from "@/components/segmented-controls";
import {MikeMode} from "@/lib/types/mode";

export const SelectMode = () => {
  const { selectedMode, setSelectedMode } = useAppState();

  const getWaitingTimeStr = () => {
    if (selectedMode === "research")
      return "1 à 2 minutes";
    if (selectedMode === "synthesis")
      return "1 minute";
    if (selectedMode === "analysis")
      return "1 minute";
    return "";
  }

  return (
    <div className="space-y-4">
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
            icon: <FileSearchIcon className="w-4 h-4"/>
          },
          {
            label: "Synthèse",
            value: "synthesis",
            icon: <FileIcon className="w-4 h-4"/>
          },
        ]}
      />
      <div className="flex items-center justify-center w-full">
        <span
          className="text-gray-500 text-sm font-medium text-center">
          {`Temps d'attente estimé: ${getWaitingTimeStr()}`}
        </span>
      </div>
    </div>
  );
}
