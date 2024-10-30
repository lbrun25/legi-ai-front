import {Button} from "@/components/ui/button";
import {FileUpIcon} from "lucide-react";
import React from "react";
import {cn} from "@/lib/utils";
import {toast} from "sonner";

interface UploadFilesButtonProps {
  isGenerating: boolean;
  onAcceptedFiles: (files: File[]) => void;
}

export const UploadFilesButton = ({ isGenerating, onAcceptedFiles }: UploadFilesButtonProps) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const maxFileSize = 512 * 1024 * 1024; // 512 MB per file
    const maxFileCount = 20;
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast.error('Certains fichiers dépassent la limite de 512 Mo.');
      return;
    }
    if (files.length > maxFileCount) {
      toast.error(`Vous pouvez télécharger un maximum de ${maxFileCount} fichiers.`);
      return;
    }
    onAcceptedFiles(files);
  };

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className={cn('h-12 w-12 rounded-full resize-none')}
        onClick={handleButtonClick}
        disabled={isGenerating}
      >
        <FileUpIcon />
      </Button>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="*/*"
      />
    </>
  );
};
