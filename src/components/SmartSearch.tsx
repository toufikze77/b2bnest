
import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, Clock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from '@/contexts/SearchContext';

interface SmartSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  showFilters?: boolean;
}

const SmartSearch = ({ onSearch, placeholder = "Search forms and documents...", showFilters = true }: SmartSearchProps) => {
  const {
    searchQuery,
    suggestions,
    recentSearches,
    filters,
    isSearching,
    setSearchQuery,
    setFilters,
    addToRecentSearches
  } = useSearch();
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const categories = ['Legal Documents', 'Human Resources', 'Financial Forms', 'Operations'];
  const popularTags = ['Contract', 'Invoice', 'Agreement', 'Template', 'Report', 'Form'];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      addToRecentSearches(query);
      onSearch(query);
    }
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
    onSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId];
    setFilters({ categories: newCategories });
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(searchQuery.length > 0 || recentSearches.length > 0)}
          className="pl-12 pr-20 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 shadow-lg"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="p-1 h-8 w-8 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {showFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`p-2 h-8 hover:bg-gray-100 ${showFiltersPanel ? 'bg-gray-100' : ''}`}
            >
              <Filter className="h-4 w-4" />
            </Button>
          )}
          {isSearching && (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          )}
        </div>
      </div>

      {/* Search Suggestions */}
      {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
        <Card className="absolute top-full left-0 right-0 mt-2 shadow-lg z-50" ref={suggestionsRef}>
          <CardContent className="p-0">
            {/* Recent Searches */}
            {recentSearches.length > 0 && searchQuery.length === 0 && (
              <div className="p-4 border-b">
                <div className="flex items-center text-sm text-gray-500 mb-2">
                  <Clock className="h-4 w-4 mr-2" />
                  Recent Searches
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(search)}
                      className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-4">
                <div className="flex items-center text-sm text-gray-500 mb-2">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Suggestions
                </div>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                    >
                      <span className="font-medium">
                        {suggestion.slice(0, searchQuery.length)}
                      </span>
                      {suggestion.slice(searchQuery.length)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advanced Filters Panel */}
      {showFiltersPanel && (
        <Card className="absolute top-full left-0 right-0 mt-2 shadow-lg z-40">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={filters.categories.length === 0 ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilters({ categories: [] })}
                  >
                    All
                  </Badge>
                  {categories.map((category) => (
                    <Badge
                      key={category}
                      variant={filters.categories.includes(category) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleCategoryToggle(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Minimum Rating</label>
                <div className="flex gap-2">
                  {[0, 3, 4, 4.5].map((rating) => (
                    <Badge
                      key={rating}
                      variant={filters.rating === rating ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFilters({ rating: filters.rating === rating ? 0 : rating })}
                    >
                      {rating === 0 ? 'Any' : `${rating}+ ★`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Popular Tags</label>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const newTags = filters.tags.includes(tag)
                          ? filters.tags.filter(t => t !== tag)
                          : [...filters.tags, tag];
                        setFilters({ tags: newTags });
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ categories: [], rating: 0, tags: [] })}
                >
                  Clear Filters
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowFiltersPanel(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartSearch;
