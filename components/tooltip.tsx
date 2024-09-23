"use client"
import React, {useState} from "react";
import {Button, ButtonProps} from "@/components/ui/button";

type TooltipProps = {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'left' | 'right' | 'bottom';
  buttonProps?: ButtonProps;
  hideAfterClicking?: boolean;
};

export const Tooltip = ({ text, children, position = 'top', buttonProps, hideAfterClicking }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [wasClicked, setWasClicked] = useState(false); // New state to handle click behavior

  const handleMouseEnterTrigger = () => {
    // Show tooltip only if it wasn't hidden by a click
    if (!wasClicked) {
      setIsVisible(true);
    }
  };

  const handleMouseLeaveTrigger = () => {
    setIsVisible(false);
    setWasClicked(false);
  };

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

  const getChevronColorClasses = () => {
    return 'border-t-transparent border-l-transparent';
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log('handleClick:', handleClick);
    if (buttonProps?.onClick) {
      buttonProps.onClick(event);
    }

    if (hideAfterClicking) {
      setIsVisible(false); // Hide the tooltip after clicking
      setWasClicked(true); // Set flag to prevent tooltip from reappearing
    }
  };

  const { onClick, ...restButtonProps } = buttonProps || {};

  return (
    <div className="relative inline-block">
      {/* Trigger Element */}
      <Button
        onMouseEnter={handleMouseEnterTrigger}
        onMouseLeave={handleMouseLeaveTrigger}
        onFocus={handleMouseEnterTrigger}
        onBlur={handleMouseLeaveTrigger}
        aria-describedby="tooltip"
        tabIndex={0} // Makes the div focusable for accessibility
        className="cursor-pointer"
        onClick={handleClick}
        {...restButtonProps}
      >
        {children}
      </Button>

      {/* Tooltip Content */}
      {isVisible && (
        <div
          id="tooltip"
          role="tooltip"
          onMouseEnter={handleMouseLeaveTrigger} // Hide tooltip when mouse hovers over it
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
