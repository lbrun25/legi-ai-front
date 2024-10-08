import {useState} from "react";
import {CheckIcon, CopyIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import markdownToTxt from "markdown-to-txt";

interface CopyButtonProps {
  contentToCopy: string;
}

export const CopyButton = ({contentToCopy}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const onCopy = (text: string) => {
    const formattedText = markdownToTxt(text);
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopied(true); // Set state to true to display the checkmark
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  return (
    <Button variant="capsule" onClick={() => onCopy(contentToCopy)}>
      <div className="flex flex-row space-x-2 items-center">
        {copied ? (
          <CheckIcon className="h-4 w-4"/>
        ) : (
          <CopyIcon className="h-4 w-4"/>
        )}
        <span className="text-sm font-medium">
          {"Copier"}
        </span>
      </div>
    </Button>
  );
};
