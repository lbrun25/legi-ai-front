export const AssistantRoleMessage = () => {
  return (
    <div className="flex flex-row items-center space-x-3">
      <div
        className={`w-[42px] h-[42px] rounded-full flex items-center justify-center z-20 bg-gradient-to-bl from-[#F0BAF3] to-[#FFBCBF] `}>
        <span className="text-xl font-bold items-center justify-center text-center text-white font-montserrat">
          {"m"}
        </span>
        <span className="text-3xl absolute top-[-1px] right-[5px] text-white font-montserrat">
          {"."}
        </span>
      </div>
      <span className="text-xl font-bold">
        {"mike."}
      </span>
    </div>
  )
}
