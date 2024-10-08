import {Dialog, DialogTrigger} from "@/components/ui/dialog";
import {VoteDialogContent} from "@/components/vote-dialog-content";
import {Button} from "@/components/ui/button";
import {ThumbsDownIcon} from "lucide-react";
import {useState} from "react";

interface DownvoteButtonProps {
  onSendClicked: (comment: string) => void;
}

export const DownvoteButton = ({onSendClicked}: DownvoteButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="capsule">
          <ThumbsDownIcon className="h-4 w-4"/>
        </Button>
      </DialogTrigger>
      <VoteDialogContent
        title="Dites-nous pourquoi cette réponse ne vous convient pas"
        onSendClicked={(comment) => {
          setOpen(false);
          onSendClicked(comment);
        }}
      />
    </Dialog>
  );
}
