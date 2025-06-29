
import React from 'react';

interface QuickSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

const QuickSuggestions = ({ suggestions, onSuggestionClick }: QuickSuggestionsProps) => {
  return (
    <div className="p-4 border-t bg-gradient-to-r from-blue-50 to-purple-50">
      <p className="text-xs text-gray-600 mb-2 font-medium">Try asking me:</p>
      <div className="grid grid-cols-1 gap-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(suggestion)}
            className="text-xs bg-white border rounded-lg px-3 py-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300 transition-all duration-200 text-left"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickSuggestions;
