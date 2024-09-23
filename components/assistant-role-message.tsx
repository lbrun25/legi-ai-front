import Image from "next/image";
import {useEffect, useRef} from "react";
import {AssistantState} from "@/lib/types/assistant";
import {cn} from "@/lib/utils";

interface AssistantRoleMessageProps {
  state: AssistantState;
}

export const AssistantRoleMessage = ({state}: AssistantRoleMessageProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (state === "thinking")
        videoRef.current.playbackRate = 3.0;
      if (state === "waiting")
        videoRef.current.playbackRate = 0.8;
    }
  }, [state]);

  return (
    <div className="relative flex flex-row items-center">
      {(state === "thinking" || state === "waiting") && (
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
            "absolute object-cover transition-all duration-500 ease-in-out",
            state === "thinking" ? "left-[-94px] w-[80px] h-[80px]" : "left-[-56px] w-[42px] h-[42px]"
          )}
        >
          <source src="/mike.mov" type='video/mp4'/>
          <source src="/mike.webm" type="video/webm"/>
          Votre navigateur ne prend pas en charge la vidéo.
        </video>
      )}
      <Image
        className={cn(
          "absolute left-[-56px]",
          state !== "finished" ? "hidden" : "block"
        )}
        src="/mike-logo-42.webp"
        alt="mike logo"
        height={42}
        width={42}
        priority
      />
      <span className="text-xl font-bold">
        {"mike"}
      </span>
    </div>
  )
}
