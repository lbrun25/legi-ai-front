"use client"
import {Assistant} from "@/components/assistant";
import {useEffect, useState} from "react";
import {OpenAI} from "openai";

export interface ThreadPageProps {
  params: {
    id: string
  }
}

export default function Page({ params }: ThreadPageProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [openaiMessages, setOpenaiMessages] = useState<OpenAI.Beta.Threads.Message[]>([]);

  const threadId = params.id;

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/threads/${threadId}/messages`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setOpenaiMessages(data.reverse());
      } catch (err: any) {
        console.log('fetchMessages err:', err)
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [threadId]);

  return (
    <Assistant threadId={threadId} openaiMessages={openaiMessages} />
  )
}
