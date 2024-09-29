"use client"
import {ClockIcon, HandHelpingIcon, SparkleIcon} from "lucide-react";
import {useAppState} from "@/lib/context/app-state";
import {formatTimeSaved} from "@/lib/utils/time";

export const TimeSaved = () => {
  const {timeSaved} = useAppState();
  const formattedTime = formatTimeSaved(timeSaved);

  return (
    <div className="flex flex-col space-y-2 items-center justify-center">
      <div className="relative flex flex-col">
        <SparkleIcon className="absolute top-[0px] right-[-12px] w-3 h-3"/>
        <SparkleIcon className="absolute bottom-[14px] left-[-10px] w-3 h-3"/>
        <ClockIcon/>
        <HandHelpingIcon className="mt-[-6px] ml-[-2px]"/>
      </div>
      <span className="font-medium text-sm">{`${formattedTime} économisées`}</span>
    </div>
  )
}
