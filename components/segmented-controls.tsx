import {useEffect, useState} from "react";

interface Segment {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface SegmentedControlProps {
  name: string;
  segments: Segment[];
  onSelected: (value: string) => void;
  value: string;
}

export const SegmentedControl = ({ name, segments, onSelected, value }: SegmentedControlProps) => {
  console.log('value:', value)
  const [activeIndex, setActiveIndex] = useState(() =>
    segments.findIndex(segment => segment.value === value)
  );

  useEffect(() => {
    if (!value) return;
    setActiveIndex(segments.findIndex(segment => segment.value === value));
  }, [value]);

  const handleChange = (value: string, index: number) => {
    setActiveIndex(index);
    onSelected(value);
  };

    return (
    <div className="relative flex items-center bg-gray-200 rounded-full p-2 max-w-[600px] mx-auto">
      {/* Blue highlight indicator */}
      <div
        className="absolute top-0 bottom-0 left-0 h-full bg-blue-500 rounded-full transition-transform duration-300"
        style={{ width: `${100 / segments.length}%`, transform: `translateX(${100 * activeIndex}%)` }}
      />
      {/* Option buttons */}
      {segments.map((segment, index) => (
        <div key={segment.value} className="relative z-10 flex-1 text-center">
          <input
            type="radio"
            value={segment.value}
            id={segment.label}
            name={name}
            onChange={() => handleChange(segment.value, index)}
            checked={index === activeIndex}
            className="sr-only"
          />
          <label
            htmlFor={segment.label}
            className={`block cursor-pointer transition-colors duration-300 font-semibold text-sm ${
              index === activeIndex ? "text-white" : "text-gray-600"
            }`}
          >
            <div className="flex flex-row gap-2 items-center justify-center">
              {segment.icon}
              {segment.label}
            </div>
          </label>
        </div>
      ))}
    </div>
  );
};
