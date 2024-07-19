"use client"
import {Assistant} from "@/components/assistant";

export interface ThreadPageProps {
  params: {
    id: string
  }
}

export default function Page({ params }: ThreadPageProps) {
  const threadId = params.id;

  return (
    <Assistant threadId={threadId} />
  )
}
