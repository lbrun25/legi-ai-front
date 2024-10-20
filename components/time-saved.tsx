"use client"
import {ClockIcon, HandHelpingIcon, SparkleIcon} from "lucide-react";
import {useAppState} from "@/lib/context/app-state";
import {formatTimeSaved} from "@/lib/utils/time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import React from "react";
import ReactMarkdown from "react-markdown";

export const TimeSaved = () => {
  const {timeSaved} = useAppState();
  const formattedTime = formatTimeSaved(timeSaved);

  const description = `
⏳ **Estimation de gain de temps** pour réaliser des recherches juridiques ou rédiger des documents avec l’aide de mike en comparant le temps que cette tâche aurait pris sans l'aide de mike pour le même résultat.

Cette estimation est fondée sur les **principales études publiées** ([1,2](https://legi-ai-front.vercel.app/)) sur le sujet et sur des **données empiriques** collectées de façon anonyme auprès de nos utilisateurs. mike intègre dans son calcul des facteurs tels que la **complexité de la tâche en elle-même**, les diverses **sources consultée** et les **étapes nécessaires** pour réaliser la tâche.
`;

  return (
    <Dialog>
      <div className="flex flex-row space-x-3 items-center">
        <DialogTrigger>
          <div className="relative flex flex-col cursor-pointer">
            <SparkleIcon className="absolute top-[-2px] right-[-12px] w-3 h-3"/>
            <SparkleIcon className="absolute bottom-[10px] left-[-10px] w-3 h-3"/>
            <ClockIcon className="h-5 w-5"/>
            <HandHelpingIcon className="mt-[-6px] ml-[-2px] h-5 w-5"/>
          </div>
        </DialogTrigger>
        <span className="font-medium text-sm">{`${formattedTime} économisées`}</span>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="mb-4">{"Comment le temps économisé est-il calculé ?"}</DialogTitle>
          <DialogDescription className="text-gray-800 dark:text-gray-200">
            <ReactMarkdown
              className="prose-sm xl:prose-base prose-li:list-disc pr-2 prose-a:underline prose-a:text-blue-500 prose-a:font-medium"
            >
              {description}
            </ReactMarkdown>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
