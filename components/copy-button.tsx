import {Tooltip} from "@/components/tooltip";
import {useState} from "react";
import {CheckIcon, CopyIcon} from "lucide-react";

interface CopyButtonProps {
  contentToCopy: string;
}

export const CopyButton = ({contentToCopy}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const onCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); // Set state to true to display the checkmark
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  return (
    <Tooltip
      text="Copier"
      position="bottom"
      buttonProps={{
        variant: 'ghost',
        size: 'icon',
        onClick: () => onCopy(contentToCopy),
      }}
      hideAfterClicking
    >
      {copied ? (
        <CheckIcon className="h-4 w-4"/>
      ) : (
        <CopyIcon className="h-4 w-4"/>
      )}
    </Tooltip>
  );
};
