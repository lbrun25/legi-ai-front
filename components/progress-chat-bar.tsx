import React, { useEffect, useState } from 'react';

export const ProgressChatBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (progress < 75) {
      // First phase: 0% to 75% in 5 seconds
      const duration = 4000; // 5 seconds
      const increment = 75 / (duration / 10); // Increment per 10ms to reach 75% in 5 seconds

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          return newProgress >= 75 ? 75 : newProgress;
        });
      }, 10); // 10ms interval
    } else if (progress >= 75 && progress < 99) {
      // Second phase: 75% to 99% in 3 seconds
      const duration = 3000; // 3 seconds
      const increment = 24 / (duration / 10); // Increment per 10ms to reach 99% in 3 seconds

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          return newProgress >= 99 ? 99 : newProgress;
        });
      }, 10); // 10ms interval
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [progress]);

  const getProgressText = () => {
    if (progress < 75) {
      return "Compréhension de la question...";
    } else if (progress < 100) {
      return "Recherche dans nos données...";
    } else {
      return "";
    }
  };

  return (
    <div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {getProgressText()}
      </div>
    </div>
  );
};
