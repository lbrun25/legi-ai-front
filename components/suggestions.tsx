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
      text: "Aide moi à trouver une jurisprudence",
      icon: <ScaleIcon/>
    },
    {
      id: "analysis",
      text: "Aide moi dans ma recherche juridique",
      icon: <SearchIcon/>,
    },
    {
      id: "redaction",
      text: "Aide-moi à identifier les articles de loi pertinents",
      icon: <BookIcon/>
    }
  ];

  return (
    <div className="space-y-4 place-self-center">
      <span className="text-gray-500 text-xs font-medium text-center">{"Commencez par un exemple ci-dessous"}</span>
      <div className="grid grid-cols-3 gap-4 max-w-xl place-self-center">
        {suggestions.map((suggestion, index) => (
          <button
            id={suggestion.id}
            className="flex flex-col h-full"
            onClick={() => {
              onSuggestionClicked(suggestion.text);
              if (selectedMode !== "analysis" && suggestion.id === "analysis")
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
