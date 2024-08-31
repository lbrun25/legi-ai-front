"use client";
import {useState, useRef} from "react";
import {blobToBase64, createMediaStream} from "@/lib/utils/audio";
import {toast} from 'sonner'

export const useRecordVoice = () => {
  const [text, setText] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const isRecording = useRef(false);
  const chunks = useRef<BlobPart[]>([]);
  const [peak, setPeak] = useState(0);

  const record = (mediaRecorder: MediaRecorder | null) => {
    if (!mediaRecorder) return;
    isRecording.current = true;
    mediaRecorder.start();
    setRecording(true);
  }

  const startRecording = async () => {
    if (!mediaRecorder) {
      if (typeof window !== "undefined") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({audio: true});
          const initiatedMediaRecorder = initialMediaRecorder(stream);
          setMediaRecorder(initiatedMediaRecorder);
          record(initiatedMediaRecorder);
        } catch (error) {
          console.error('Error accessing microphone:', error);
          toast.info("Autoriser l'accès à votre microphone");
        }
      }
    }
    if (mediaRecorder) {
      record(mediaRecorder);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      isRecording.current = false;
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const getText = async (base64data: string) => {
    try {
      const response = await fetch("/api/audio/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({audioData: base64data}),
      });
      if (!response.ok) {
        console.error("cannot transcript audio:", response.statusText);
      }
      const {text} = await response.json();
      setText(text);
    } catch (error) {
      console.error("cannot transcript audio:", error);
    }
  };

  const initialMediaRecorder = (stream: MediaStream): MediaRecorder | null => {
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.onstart = () => {
      createMediaStream(stream, isRecording.current, (peak) => setPeak(peak));
      chunks.current = [];
    };

    mediaRecorder.ondataavailable = (ev: BlobEvent) => {
      chunks.current.push(ev.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunks.current, {type: "audio/wav"});
      blobToBase64(audioBlob, getText);
    };

    return mediaRecorder;
  };

  return {recording, startRecording, stopRecording, text, peak};
};
