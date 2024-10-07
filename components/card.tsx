import React from "react";

interface CardProps {
  text: string;
  icon?: React.ReactNode;
}

export const Card = ({text, icon}: CardProps) => {
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 shadow rounded-2xl space-y-4 px-4 py-5 cursor-pointer hover:bg-gray-200 hover:dark:bg-gray-800">
      {icon &&
        <div className="flex">
          <div
            className="p-3 rounded-2xl bg-gradient-to-b from-pink-50 to-blue-100 dark:from-gray-900 dark:to-blue-950">
          <span className="items-center justify-center text-gray-950 dark:text-white">
            {React.cloneElement(icon as React.ReactElement, {className: "w-5 h-5"})}
          </span>
          </div>
        </div>
      }
      <span className="font-medium text-sm text-left">{text}</span>
    </div>
  )
}
