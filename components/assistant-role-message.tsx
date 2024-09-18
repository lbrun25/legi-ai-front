import Image from "next/image";

export const AssistantRoleMessage = () => {
  return (
    <div className="flex flex-row space-x-4 items-center">
      <Image src="/mike-logo.png" alt="mike logo" height={42} width={42} />
      <span className="text-xl font-bold">{"mike"}</span>
    </div>
  )
}
