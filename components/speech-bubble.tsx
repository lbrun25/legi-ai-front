interface SpeechBubbleProps {
  text: string;
}

export const SpeechBubble = ({text}: SpeechBubbleProps) => {
  return (
    <div className="flex flex-col max-w-2xl cursor-pointer">
      <div className="rounded-3xl p-6 h-16 border border-gray-200 bg-gray-50 flex items-center hover:bg-blue-100/20 hover:border-blue-100">
        <p className="text-sm	font-medium text-left">{text}</p>
      </div>
      <div className="flex flex-col relative bg-green-500">
        <div className="absolute top-[-10px] left-[1px]">
          <div
            className="absolute -z-10 top-0 left-[-2px] border border-gray-200 bg-gray-50 rounded-full w-4 h-4 shadow-md hover:bg-blue-100/20 hover:border-blue-100"></div>
          <div className="absolute top-[12px] left-[-10px] border border-gray-200 bg-gray-50 rounded-full w-3 h-3 shadow-md hover:bg-blue-100/20 hover:border-blue-100"></div>
        </div>
      </div>
    </div>
  );
};
