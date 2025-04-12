import React, { useState, useEffect } from "react";
import Select, {ActionMeta, SingleValue} from "react-select";

const DEBOUNCE_DELAY = 500; // 500ms debounce delay

interface SearchBarProps {
  onSelect: (suggestion: { title: string; idcc: string }) => void;
}

// Define the shape of options in react-select
interface Option {
  value: string; // Stores a combined representation (e.g., "1234 - Title")
  label: string; // Displayed in dropdown (e.g., "Title (IDCC: 1234)")
  title: string;
  idcc: string;
}

export const SearchBarAgreements: React.FC<SearchBarProps> = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SingleValue<Option>>(null);

  // Debounce Effect for API Calls
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
      }
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Fetch Suggestions from API
  const fetchSuggestions = async (query: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/collectiveAgreements/search?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }
      const data = await response.json();
      const formattedSuggestions = data.suggestions.map((suggestion: { title: string; idcc: string }) => ({
        value: `${suggestion.idcc} - ${suggestion.title}`,
        label: `${suggestion.title} (IDCC: ${suggestion.idcc})`,
        title: suggestion.title,
        idcc: suggestion.idcc,
      }));
      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Selection or Clearing of the Dropdown
  const handleSelect = (selectedOption: SingleValue<Option>, actionMeta: ActionMeta<Option>) => {
    if (actionMeta.action === "clear") {
      setQuery("");
      setSuggestions([]);
      setSelectedOption(null);
      onSelect({ title: "", idcc: "" });
    } else if (selectedOption) {
      setQuery(selectedOption.title); // Display the selected title in the input
      setSelectedOption(selectedOption); // Update selected option
      setSuggestions([]);
      onSelect({ title: selectedOption.title, idcc: selectedOption.idcc });
    }
  };

  return (
    <div className="relative w-full">
      <Select
        value={selectedOption}
        onInputChange={(value, action) => {
          if (action.action !== "input-blur" && action.action !== "menu-close") {
            if (action.action !== "set-value") {
              setQuery(value);
            }
          }
        }}
        onChange={handleSelect}
        options={suggestions}
        isLoading={isLoading}
        placeholder="Rechercher par titre ou IDCC..."
        noOptionsMessage={() => "Aucune suggestion"}
        loadingMessage={() => "Chargement..."}
        className="w-full text-sm"
        classNamePrefix="search-bar"
        isClearable
      />
    </div>
  );
};
