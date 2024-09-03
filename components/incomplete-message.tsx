import {Button} from "@/components/ui/button";
import {RotateCcw} from "lucide-react";

interface IncompleteMessageProps {
  onRetryClicked: () => void;
}

export const IncompleteMessage = ({onRetryClicked}: IncompleteMessageProps) => {
  return (
    <div className="flex flex-col space-y-4 text-center justify-center">
      <span className="text-sm font-bold">{"Une erreur s'est produite lors de la génération de la réponse"}</span>
      <Button
        className="bg-blue-600 hover:bg-blue-600/90 dark:bg-blue-300 dark:hover:bg-blue-300/90 font-medium"
        onClick={onRetryClicked}
      >
        <RotateCcw size={16} className="mr-1" />
        <span>{"Régénérer la réponse"}</span>
      </Button>
    </div>
  )
}
