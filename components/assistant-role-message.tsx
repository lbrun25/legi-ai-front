import Image from "next/image";
import {useEffect, useRef} from "react";

interface AssistantRoleMessageProps {
  thinking: boolean;
}

export const AssistantRoleMessage = ({thinking}: AssistantRoleMessageProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 3.0; // Set video speed to 2x
    }
  }, []);

  return (
    <div className="relative flex flex-row items-center">
      {thinking && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          width={80}
          height={80}
          className="absolute left-[-94px] w-[80px] h-[80px] object-cover"
        >
          <source src="/mike.mov" type='video/mp4'/>
          <source src="/mike.webm" type="video/webm"/>
          Votre navigateur ne prend pas en charge la vidéo.
        </video>
      )}
      {!thinking && (
        <Image
          className="absolute left-[-56px]"
          src="/mike-logo-42.png"
          alt="mike logo"
          height={42}
          width={42}
          priority
        />
      )}
      <span className="text-xl font-bold">
        {"mike"}
      </span>
    </div>
  )
}
