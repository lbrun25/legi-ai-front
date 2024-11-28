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
import {Button} from "@/components/ui/button";

export const HelpSidebarButton = () => {
  const { hasJustSignUp } = useAppState();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(2);

  useEffect(() => {
    if (!hasJustSignUp) return;
    setIsDialogOpen(true);
    setCurrentPage(1);
  }, [hasJustSignUp]);

  const description = `
À date, il existe 3 fonctionnalités avec mike, à sélectionner :

1. ⚖️ **Recherche juridique** : mike répond à vos problèmes de droit, en citant les articles, jurisprudences et éléments de doctrine pertinent.\\
💡 ***Comment ?*** Posez votre problème juridique ou question de droit en **langage simple** dans la zone de texte, comme si vous vous **adressiez à un collaborateur** 🗣️, en précisant autant que possible les éléments pertinents de contexte de votre cas ou de votre problème juridique.



2. 🔍 **Analyse de document** : mike répond à toutes vos questions sur n’importe quel document et extrait les informations clés\\
💡 ***Comment ?*** Cliquez sur “Analyse” puis chargez votre document à analyser en cliquant sur la petite flèche à gauche de la zone de texte. Ensuite, demandez tout ce que vous voulez savoir sur le document.



3. 📖 **Résumé de document** : mike résume n’importe quel document en quelques lignes, selon vos souhaits.\\
💡 ***Comment ?*** Cliquez sur “Synthèse, puis chargez votre document à synthétiser en cliquant sur la petite flèche à gauche de la zone de texte. Ensuite, demandez à mike de synthétiser le document.

Grâce à vous de nouvelles fonctionnalités arriveront si vous les jugez pertinentes : gestion automatique des emails, aide à la rédaction, dictée intelligente… **Dites nous ce que vous aimeriez !**
`;

  const welcomeMessage = `
mike AI est une IA juridique de pointe conçue en France 🇫🇷 aux côtés des professionnels du droit pour vous aider à réaliser en quelques minutes des **tâches fastidieuses du quotidien** facilement et de façon sécurisée.

mike utilise simultanément plusieurs modèles IA génératives pour donner les réponses les plus fiables possibles, **sans hallucination**.

Nous sommes en **phase beta** et nous travaillons à vos côtés pour l’améliorer tous les jours. 🚀 **Merci** de faire partie de cette aventure. Le **futur se construit avec vous**.

🔒Il est précisé que toutes **vos données sont sécurisées** et stockées sur un serveur souverain Français. Personne d’autre que vous ne peut y avoir accès.
`;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger className="hover:bg-gray-200 dark:hover:bg-gray-800">
        <div className="flex flex-row space-x-2 py-4 pl-4 w-full">
          <LightbulbIcon className="h-5 w-5" />
          <span className="font-semibold text-sm">
            {"Guide d'utilisation"}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="mb-4">
            {currentPage === 1 ? "Bienvenue sur mike. en accès prioritaire ☺️👋🏼" : "Comment utiliser mike AI ?"}
          </DialogTitle>
          <DialogDescription className="text-gray-800 dark:text-gray-200">
            <ReactMarkdown
              className="prose-sm xl:prose-base prose-li:list-decimal pr-2"
            >
              {currentPage === 1 ? welcomeMessage : description}
            </ReactMarkdown>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-between">
          {(currentPage === 2 && hasJustSignUp) && (
            <Button
              onClick={() => setCurrentPage(1)}
              variant="secondary"
            >
              {"Précédent"}
            </Button>
          )}
          {currentPage === 1 && (
            <Button
              onClick={() => setCurrentPage(2)}
              variant="default"
            >
              {"Valider"}
            </Button>
          )}
          {currentPage === 2 && (
            <Button
              onClick={() => setIsDialogOpen(false)}
              variant="default"
            >
              {"J'ai compris"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
