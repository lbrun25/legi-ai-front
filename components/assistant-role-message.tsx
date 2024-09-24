export const AssistantRoleMessage = () => {
  return (
    <div className="relative flex flex-row items-center">
      <div
        className={`absolute left-[-56px] w-[42px] h-[42px] rounded-full flex items-center justify-center z-20 bg-gradient-to-bl from-[#F0BAF3] to-[#FFBCBF] `}>
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
