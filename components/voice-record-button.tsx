import {Button} from "@/components/ui/button";
import {Mic, Square} from "lucide-react";
import React, {useEffect} from "react";
import {cn} from "@/lib/utils";
import {useRecordVoice} from "@/lib/hooks/use-record-voice";

interface RecordButtonProps {
  isGenerating: boolean;
  onReceivedText: (text: string) => void;
}

export const VoiceRecordButton = ({isGenerating, onReceivedText}: RecordButtonProps) => {
  const {startRecording, stopRecording, text, recording: isRecording, peak} = useRecordVoice();

  useEffect(() => {
    if (text)
      onReceivedText(text);
  }, [text]);

  return (
    <Button
      size={'icon'}
      variant={'secondary'}
      className={cn(
        'h-12 w-12 rounded-full resize-none',
        isRecording ? 'bg-red-500 hover:bg-red-500/90' : 'bg-muted'
      )}
      disabled={isGenerating}
      onClick={() => isRecording ? stopRecording() : startRecording()}
    >
      {isRecording ? <Square/> : <Mic/>}
    </Button>
  );
}
