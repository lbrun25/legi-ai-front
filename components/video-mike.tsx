"use client"
import {useEffect, useRef} from "react";
import {cn} from "@/lib/utils";
import {useAppState} from "@/lib/context/app-state";

export const VideoMike = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { isGenerating, isStreaming } = useAppState()

  useEffect(() => {
    if (videoRef.current) {
      if (isGenerating && !isStreaming)
        videoRef.current.playbackRate = 3.0;
      else
        videoRef.current.playbackRate = 0.8;
    }
  }, [isGenerating, isStreaming]);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      width={80}
      height={80}
      className={cn(
        "object-cover transition-all duration-500 ease-in-out",
        (isGenerating && !isStreaming) ? "w-[80px] h-[80px]" : "w-[42px] h-[42px]"
      )}
    >
      <source src="/mike.mov" type='video/mp4'/>
      <source src="/mike.webm" type="video/webm"/>
      Votre navigateur ne prend pas en charge la vidéo.
    </video>
  );
}
