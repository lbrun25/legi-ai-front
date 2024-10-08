import {DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import React, {useState} from "react";
import {Textarea} from "@/components/ui/textarea";
import {Button} from "@/components/ui/button";

interface VoteDialogContentProps {
  title: string;
  onSendClicked: (comment: string) => void;
}

export const VoteDialogContent = ({title, onSendClicked}: VoteDialogContentProps) => {
  const [comment, setComment] = useState<string>("");

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="mb-4">
          {title}
        </DialogTitle>
      </DialogHeader>
      <Textarea
        name="input"
        rows={5}
        tabIndex={0}
        placeholder="Votre commentaire..."
        value={comment}
        className="resize-none w-full h-40 rounded-fill bg-muted border border-input pl-4 pr-10 pt-3 pb-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'"
        onChange={e => setComment(e.target.value)}
      />
      <Button
        variant="default"
        className="mt-2"
        onClick={() => onSendClicked(comment)}
      >
        {"Envoyer"}
      </Button>
    </DialogContent>
  )
}
