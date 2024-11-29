"use client";
import React, {useState} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {FileUpIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import UploadedFilesList from "@/components/uploaded-files-list";
import {AnalysisQuestionList} from "@/components/analysis-question-list";
import {AnalysisQuestion} from "@/lib/types/analysis";
import {useRouter} from "next/navigation";
import {useAppState} from "@/lib/context/app-state";

export const DisplayTableExtractionButton = () => {
  const router = useRouter();
  const { setAnalysisFiles } = useAppState();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [acceptedFiles, setAcceptedFiles] = useState<File[]>([]);
  const [questions, setQuestions] = useState<AnalysisQuestion[]>([
    { content: "", answerType: "text" },
  ]);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAcceptedFiles(files);
  };

  const handleDeleteFile = (fileToDelete: File) => {
    setAcceptedFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

  const handleQuestionsChange = (updatedQuestions: AnalysisQuestion[]) => {
    setQuestions(updatedQuestions);
  };

  const onStartAnalysisClicked = () => {
    router.push(
      `/analysis?questions=${encodeURIComponent(JSON.stringify(questions))}`
    );
    setAnalysisFiles(acceptedFiles);
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger className="flex justify-center w-full">
        <Button
          variant={'capsule'}
        >
          {"Afficher sous forme d'un tableau"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="mb-4">
            {"Analyse de documents sous forme de tableau"}
          </DialogTitle>
          <div className="space-y-8">
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={handleButtonClick}
              >
                <FileUpIcon size={18} className="mr-2"/>
                {"Importer vos fichiers"}
              </Button>
              <div className="text-sm text-muted-foreground">
                {"Seulement les fichiers .pdf sont supportés"}
              </div>
            </div>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              style={{display: 'none'}}
              onChange={handleFileChange}
              accept="*/*"
            />
            <UploadedFilesList
              files={acceptedFiles}
              uploading={false}
              onDeleteFile={handleDeleteFile}
              progress={{}}
            />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">{"Vos questions"}</h3>
              <AnalysisQuestionList
                questions={questions}
                onQuestionsChange={handleQuestionsChange}
              />
            </div>
            <div className="flex justify-center">
              <Button
                variant={'default'}
                disabled={acceptedFiles.length === 0 || questions[0].content.length === 0}
                onClick={onStartAnalysisClicked}
              >
                {"Lancer l'analyse"}
              </Button>
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
