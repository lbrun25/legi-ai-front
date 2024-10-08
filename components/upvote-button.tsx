import {Dialog, DialogTrigger} from "@/components/ui/dialog";
import {VoteDialogContent} from "@/components/vote-dialog-content";
import {Button} from "@/components/ui/button";
import {ThumbsUpIcon} from "lucide-react";
import {useState} from "react";

interface UpvoteButtonProps {
  onSendClicked: (comment: string) => void;
}

export const UpvoteButton = ({onSendClicked}: UpvoteButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="capsule">
          <ThumbsUpIcon className="h-4 w-4"/>
        </Button>
      </DialogTrigger>
      <VoteDialogContent
        title="Votre avis est précieux !"
        onSendClicked={(comment) => {
          setOpen(false);
          onSendClicked(comment);
        }}
      />
    </Dialog>
  );
}
