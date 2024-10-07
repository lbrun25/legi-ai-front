import React, {useEffect, useState} from "react";
import {ArrowRight} from "lucide-react";
import {Spinner} from "@/components/ui/spinner";

interface AnswerSuggestionsProps {
  answer: string;
  isGenerating: boolean;
  onSuggestionClicked: (text: string) => void;
}

export const AnswerSuggestions = ({answer, isGenerating, onSuggestionClicked}: AnswerSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionClicked, setSuggestionClicked] = useState(false);

  useEffect(() => {
    if (isGenerating) return;

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({answer}),
        });
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setSuggestionClicked(false);
        } else {
          console.error('Failed to fetch suggestions:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [isGenerating, answer])

  if (loading)
    return (
      <div className="flex flex-row space-x-2">
        <span className="text-gray-500 text-sm font-medium">{"Chargement des suggestions de questions"}</span>
        <Spinner/>
      </div>
    )

  if (suggestionClicked) return null;

  return (
    <div className="flex flex-col space-y-4">
      <span className="text-gray-500 text-xs font-medium text-left">{"Suggestions de questions :"}</span>
      {suggestions.map((suggestion, index) => (
        <button
          className="text-left"
          onClick={() => {
            onSuggestionClicked(suggestion)
            setSuggestionClicked(true);
          }}
        >
          <div key={index}
               className="h-full flex flex-row items-center justify-between bg-gray-50 dark:bg-gray-900 shadow rounded-2xl space-x-4 px-4 py-5 cursor-pointer hover:bg-gray-200 hover:dark:bg-gray-800">
            <span className="text-gray-600 dark:text-gray-400 font-medium text-sm pr-6">{suggestion}</span>
            <ArrowRight className="w-5 h-5 text-gray-600 dark:text-gray-400"/>
          </div>
        </button>
      ))}
    </div>
  );
}
