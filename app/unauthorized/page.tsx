"use client";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";

export default function Page() {
  const router = useRouter()

  return (
    <div className="flex flex-col w-full max-w-md	py-24 mx-auto">
      <div className="flex flex-col gap-8 justify-center">
        <h1 className="text-3xl font-bold text-center">
          {"Not authorized"}
        </h1>
        <Button
          onClick={() => router.push('/')}
        >
          {"Go Home"}
        </Button>
      </div>
    </div>
  )
}
