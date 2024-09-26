import {User} from "lucide-react";

export const UserRoleMessage = () => {
  return (
    <div className="flex flex-row items-center space-x-3">
      <div className={`w-[42px] h-[42px] bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center`}>
        <User width={21} height={21} />
      </div>
      <span className="text-xl font-bold">{"Maître"}</span>
    </div>
  )
}
