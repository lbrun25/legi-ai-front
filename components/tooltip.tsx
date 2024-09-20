"use client"
import React, {useState} from "react";

type TooltipProps = {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'left' | 'right' | 'bottom';
};

export const Tooltip = ({text, children, position = 'top'}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Handlers for the trigger element
  const handleMouseEnterTrigger = () => setIsVisible(true);
  const handleMouseLeaveTrigger = () => setIsVisible(false);

  // Handler for the tooltip itself
  const handleMouseEnterTooltip = () => setIsVisible(false);

  // Function to get position-based classes for the tooltip
  const getTooltipPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'right-full mr-2 top-1/2 transform -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 transform -translate-y-1/2';
      case 'bottom':
        return 'top-full mt-2 left-1/2 transform -translate-x-1/2';
      default: // 'top'
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
    }
  };

  // Function to get chevron positioning and orientation
  const getChevronPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'right-[-5px] top-1/2 transform -translate-y-1/2 rotate-45';
      case 'right':
        return 'left-[-5px] top-1/2 transform -translate-y-1/2 -rotate-45';
      case 'bottom':
        return 'top-[-5px] left-1/2 transform -translate-x-1/2 rotate-45';
      default: // 'top'
        return 'bottom-[-5px] left-1/2 transform -translate-x-1/2 -rotate-45';
    }
  };

  // Function to get chevron color based on theme
  const getChevronColorClasses = () => {
    return 'border-t-transparent border-l-transparent';
  };

  return (
    <div className="relative inline-block">
      {/* Trigger Element */}
      <div
        onMouseEnter={handleMouseEnterTrigger}
        onMouseLeave={handleMouseLeaveTrigger}
        onFocus={handleMouseEnterTrigger}
        onBlur={handleMouseLeaveTrigger}
        aria-describedby="tooltip"
        tabIndex={0} // Makes the div focusable for accessibility
        className="cursor-pointer"
      >
        {children}
      </div>

      {/* Tooltip Content */}
      {isVisible && (
        <div
          id="tooltip"
          role="tooltip"
          onMouseEnter={handleMouseEnterTooltip}
          className={`absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg ${getTooltipPositionClasses()} transition-opacity duration-300 opacity-100`}
        >
          {text}
          {/* Chevron */}
          <div
            className={`absolute w-3 h-3 border-2 border-gray-900 dark:border-gray-700 ${getChevronPositionClasses()} ${getChevronColorClasses()} bg-gray-900 dark:bg-gray-700`}
          ></div>
        </div>
      )}
    </div>
  );
};
