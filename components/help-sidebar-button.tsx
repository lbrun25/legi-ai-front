"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {LightbulbIcon} from "lucide-react";
import ReactMarkdown from "react-markdown";
import React, {useEffect, useState} from "react";
import {useAppState} from "@/lib/context/app-state";

export const HelpSidebarButton = () => {
  const { hasJustSignUp } = useAppState();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!hasJustSignUp) return;
    setIsDialogOpen(true);
  }, [hasJustSignUp]);

  const description = `
  Mike AI est conçu en France pour transformer la façon de réaliser vos recherches juridiques, en vous faisant gagner du temps et en vous aidant à trouver l’information la plus pertinente possible, facilement.

Mike rassemble des informations provenant de millions de sources légales publiques (textes de loi, règlements, traités, jurisprudences, positions libre de droit de professionnels ou professeurs de droit…) et a été entrainé par des professionnels du droit pour raisonner comme un juriste.

Etape à suivre : l’interface fonctionne comme une conversation :
1. Vous tapez votre question juridique dans la zone de texte en bas de l'écran, comme si vous vous adressiez à un collaborateur, en précisant autant que possible les éléments pertinents de contexte de vos cas ou de votre problème juridique.

2. Mike AI analyse votre demande et fournit une réponse structurée, en s'appuyant sur les meilleures sources disponibles. Plus il a d’information via des phrases complètes, plus il va pouvoir apprécier le problème et donner une réponse pertinente.

Que vous ayez besoin d'un point précis de jurisprudence, de doctrine ou d'un article de loi, ou savoir comment le droit régit une situation de fait spécifique, Mike AI vous guide en vous donnant une réponse claire et complète.
`;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger className="hover:bg-gray-200 dark:hover:bg-gray-800">
        <div className="flex flex-row space-x-2 py-4 pl-4 w-full">
          <LightbulbIcon className="h-5 w-5"/>
          <span className="font-semibold text-sm">
            {"Guide d'utilisation"}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="mb-4">
            {"Comment utiliser Mike AI pour vos recherches juridiques ?"}
          </DialogTitle>
          <DialogDescription className="text-gray-800 dark:text-gray-200">
            <ReactMarkdown
              className="prose-sm xl:prose-base prose-li:list-decimal pr-2"
            >
              {description}
            </ReactMarkdown>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
