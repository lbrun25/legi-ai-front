import { generateFormattedRandomNumber } from '@/lib/utils/randomNumber';
import React, {useEffect, useState} from 'react';

const randomNumber = generateFormattedRandomNumber(17172, 125875);

export const ProgressChatBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (progress < 25) {
      // First phase: 0% to 25% in 2 seconds (quick load, no text)
      const duration = 2000; // 2 seconds
      const increment = 25 / (duration / 10); // Increment per 10ms to reach 25% in 2 seconds

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          return newProgress >= 25 ? 25 : newProgress;
        });
      }, 10); // 10ms interval
    } else if (progress >= 25 && progress < 50) {
      // Second phase: 25% to 50% in 4 seconds
      const duration = 4000; // 4 seconds
      const increment = 25 / (duration / 10); // Increment per 10ms to reach 50% in 4 seconds

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          return newProgress >= 50 ? 50 : newProgress;
        });
      }, 10); // 10ms interval
    } else if (progress >= 50 && progress < 75) {
      // Third phase: 50% to 75% in 4 seconds
      const duration = 5000; // 6 seconds
      const increment = 25 / (duration / 10); // Increment per 10ms to reach 75% in 4 seconds

      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          return newProgress >= 75 ? 75 : newProgress;
        });
      }, 10); // 10ms interval
    } else if (progress >= 75 && progress < 100) {
      // Fourth phase: 75% to 100% in 4 seconds
      const duration = 4000; // 4 seconds
      const increment = 25 / (duration / 10); // Increment per 10ms to reach 100% in 4 seconds

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
    if (progress >= 25 && progress < 50) {
      return "Compréhension de la demande";
    } else if (progress >= 50 && progress < 75) {
      return `Recherche dans ${randomNumber} sources de droit pertinentes en temps réel`;
    } else if (progress >= 75 && progress < 100) {
      return "Suggestion de la meilleure réponse possible";
    } else {
      return "";
    }
  };

  return (
    <div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
          style={{width: `${progress}%`}}
        />
      </div>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 text-center pb-16">
        {getProgressText()}
      </div>
    </div>
  );
};
