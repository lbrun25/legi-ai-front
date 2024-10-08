import {UpvoteButton} from "@/components/upvote-button";
import React from "react";
import {insertVote} from "@/lib/supabase/vote";
import {toast} from "sonner";
import {DownvoteButton} from "@/components/downvote-button";

interface VoteButtonsProps {
  threadId: string;
  messageId: bigint;
}

export const VoteButtons = ({threadId, messageId}: VoteButtonsProps) => {
  const vote = async (comment: string, isUp: boolean) => {
    try {
      await insertVote(threadId, messageId, comment, isUp);
      toast.success("Merci pour votre avis !");
    } catch (error) {
      toast.error("Une erreur s'est produite");
    }
  }

  return (
    <div className="flex flex-row space-x-2">
      <UpvoteButton onSendClicked={(comment) => vote(comment, true)} />
      <DownvoteButton onSendClicked={(comment) => vote(comment, false)} />
    </div>
  )
}
