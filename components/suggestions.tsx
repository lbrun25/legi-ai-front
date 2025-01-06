import {Card} from "@/components/card";
import {BookIcon, ScaleIcon, SearchIcon} from "lucide-react";
import {useAppState} from "@/lib/context/app-state";

interface SuggestionsProps {
  onSuggestionClicked: (text: string) => void;
}

export const Suggestions = ({onSuggestionClicked}: SuggestionsProps) => {
  const { selectedMode, setSelectedMode } = useAppState();

  const suggestions = [
    {
      id: "research",
      text: "Aide moi à réaliser une recherche juridique",
      icon: <ScaleIcon/>
    },
    {
      id: "analysis",
      text: "Répond à des questions précises sur un document",
      icon: <SearchIcon/>,
    },
    {
      id: "redaction",
      text: "Résume ce document",
      icon: <BookIcon/>
    }
  ];

  return (
    <div className="space-y-4 place-self-center">
      <span className="text-gray-500 text-xs font-medium text-center">{"Commencez par un exemple ci-dessous"}</span>
      <div className="grid grid-cols-3 gap-4 max-w-xl place-self-center">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            id={suggestion.id}
            className="flex flex-col h-full"
            onClick={() => {
              onSuggestionClicked(suggestion.text);
              if (selectedMode !== "analysis" && suggestion.id === "analysis")
                setSelectedMode(suggestion.id);
              if (selectedMode !== "synthesis" && suggestion.id === "synthesis")
                setSelectedMode(suggestion.id);
            }}
          >
            <Card key={index} text={suggestion.text} icon={suggestion.icon}/>
          </button>
        ))}
      </div>
    </div>
  );
}
