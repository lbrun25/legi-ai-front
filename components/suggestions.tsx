import {Card} from "@/components/card";
import {BookIcon, ScaleIcon, SearchIcon} from "lucide-react";

interface SuggestionsProps {
  onSuggestionClicked: (text: string) => void;
}

export const Suggestions = ({onSuggestionClicked}: SuggestionsProps) => {
  const suggestions = [
    {
      text: "Aide moi à trouver une jurisprudence",
      icon: <ScaleIcon/>
    },
    {
      text: "Aide moi dans ma recherche juridique",
      icon: <SearchIcon/>,
    },
    {
      text: "Aide-moi à identifier les articles de loi pertinents",
      icon: <BookIcon/>
    }
  ];

  return (
    <div className="flex flex-col space-y-4">
      <span className="text-gray-500 text-xs font-medium text-center">{"Commencez par un exemple ci-dessous"}</span>
      <div className="grid grid-cols-3 gap-4 max-w-xl place-self-center">
        {suggestions.map((suggestion, index) => (
          <button
            className="flex flex-col h-full"
            onClick={() => onSuggestionClicked(suggestion.text)}
          >
            <Card key={index} text={suggestion.text} icon={suggestion.icon}/>
          </button>
        ))}
      </div>
    </div>
  );
}
