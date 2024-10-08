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
Grâce à Mike, vous gagnez un temps précieux dans vos recherches juridiques. Voici une estimation du temps économisé pour chaque type de tâche :

- **Recherche d'articles par numéro** : environ 1 minute.
- **Recherche d'articles correspondants pour des questions simples** : environ 8 minutes.
- **Recherche de décisions correspondantes sur des questions simples** : environ 45 minutes.
- **Recherche d'articles, doctrines et décisions correspondantes sur des questions simples** : environ 90 minutes.

Grâce à Mike, vous économisez un temps précieux sur chaque tâche juridique, optimisant ainsi votre productivité.
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
              className="prose-sm xl:prose-base prose-li:list-disc pr-2"
            >
              {description}
            </ReactMarkdown>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
