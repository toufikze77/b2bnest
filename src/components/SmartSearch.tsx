import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, Clock, TrendingUp, FileText, Settings, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from '@/contexts/SearchContext';
import { SearchResult } from '@/services/unifiedSearchService';

interface SmartSearchProps {
  onSearch: (query: string) => void;
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  showFilters?: boolean;
  unified?: boolean;
}

const SmartSearch = ({ 
  onSearch, 
  onResultSelect,
  placeholder = "Search tools, documents, and templates...", 
  showFilters = true,
  unified = true 
}: SmartSearchProps) => {
  const {
    searchQuery,
    suggestions,
    recentSearches,
    unifiedResults,
    filters,
    isSearching,
    setSearchQuery,
    setFilters,
    performUnifiedSearch,
    addToRecentSearches
  } = useSearch();
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const categories = ['Legal Documents', 'Human Resources', 'Financial Forms', 'Operations'];
  const popularTags = ['Contract', 'Invoice', 'Agreement', 'Template', 'Report', 'Form'];

  // Prevent focus during autofill - only for this search input
  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    const handleAutofill = (e: Event) => {
      console.log('🔍 SmartSearch autofill event:', {
        target: e.target,
        isSearchInput: e.target === inputElement,
        animationType: (e as AnimationEvent).animationName,
        searchInputId: inputElement.id || 'no-id'
      });
      
      // Only handle autofill for this specific input element
      if (e.target === inputElement && e.type === 'animationstart') {
        const animationEvent = e as AnimationEvent;
        if (animationEvent.animationName.includes('autofill')) {
          console.log('🚫 SmartSearch blocking autofill focus');
          setIsAutofilling(true);
          setTimeout(() => setIsAutofilling(false), 100);
        }
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      console.log('⌨️ SmartSearch input event:', {
        target: target,
        isSearchInput: target === inputElement,
        value: target.value,
        hasFocus: target.matches(':focus'),
        searchInputId: inputElement.id || 'no-id'
      });
      
      // Only handle for this specific input and detect autofill more accurately
      if (target === inputElement && target.value && !target.matches(':focus')) {
        console.log('🚫 SmartSearch blocking input focus');
        setIsAutofilling(true);
        setTimeout(() => setIsAutofilling(false), 100);
      }
    };

    const handleFocusCapture = (e: Event) => {
      const target = e.target as HTMLInputElement;
      console.log('👁️ SmartSearch focus capture:', {
        target: target,
        isSearchInput: target === inputElement,
        searchInputId: inputElement.id || 'no-id',
        targetId: target.id || 'no-id'
      });
    };

    inputElement.addEventListener('animationstart', handleAutofill);
    inputElement.addEventListener('input', handleInput);
    // Add focus capture to see if focus events are being triggered
    document.addEventListener('focusin', handleFocusCapture, true);

    return () => {
      inputElement.removeEventListener('animationstart', handleAutofill);
      inputElement.removeEventListener('input', handleInput);
      document.removeEventListener('focusin', handleFocusCapture, true);
    };
  }, []);

  const handleSearch = async (query: string) => {
    // Prevent search if autofilling
    if (isAutofilling) return;
    
    setSearchQuery(query);
    if (query.length > 0) {
      addToRecentSearches(query);
      if (unified) {
        await performUnifiedSearch(query);
        setShowResults(true);
      } else {
        onSearch(query);
      }
    }
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isAutofilling) return;
    handleSearch(suggestion);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent processing during autofill
    if (isAutofilling) return;
    
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.length > 0 || (value.length === 0 && suggestions.length > 0));
    setShowResults(false);
    
    if (unified && value.length > 1) {
      // Debounced search for better performance
      const timeoutId = setTimeout(() => {
        if (!isAutofilling) {
          performUnifiedSearch(value);
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (!unified) {
      onSearch(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isAutofilling) {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only handle focus for this specific search input
    if (e.target !== inputRef.current) return;
    
    // Prevent focus behavior during autofill only for this search input
    if (isAutofilling && e.target === inputRef.current) {
      e.preventDefault();
      if (e.target && e.target instanceof HTMLElement && 'blur' in e.target) {
        e.target.blur();
      }
      return;
    }
    
    setShowSuggestions(searchQuery.length > 0 || suggestions.length > 0);
    if (unified && searchQuery.length > 1) setShowResults(true);
  };

  const clearSearch = () => {
    if (isAutofilling) return;
    
    setSearchQuery('');
    setShowSuggestions(false);
    setShowResults(false);
    if (!unified) onSearch('');
    inputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAutofilling) return;
      
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAutofilling]);

  const handleCategoryToggle = (categoryId: string) => {
    if (isAutofilling) return;
    
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId];
    setFilters({ ...filters, categories: newCategories });
  };

  const handleResultClick = (result: SearchResult) => {
    if (isAutofilling) return;
    
    if (onResultSelect) {
      onResultSelect(result);
    } else if (result.url) {
      window.location.href = result.url;
    }
    setShowResults(false);
    setShowSuggestions(false);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'tool': return <Settings className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      case 'template': return <Sparkles className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
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
          onFocus={handleFocus}
          autoComplete="off"
          className={`pl-12 pr-20 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 shadow-lg ${isAutofilling ? 'pointer-events-none' : ''}`}
          style={{
            WebkitTextFillColor: 'inherit',
            transition: 'none'
          }}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {searchQuery && !isAutofilling && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="p-1 h-8 w-8 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {showFilters && !isAutofilling && (
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

      {/* Unified Search Results */}
      {unified && showResults && unifiedResults.length > 0 && !isAutofilling && (
        <Card className="absolute top-full left-0 right-0 mt-2 shadow-lg z-50" ref={suggestionsRef}>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center text-sm text-muted-foreground mb-3">
                <Search className="h-4 w-4 mr-2" />
                Found {unifiedResults.length} results
              </div>
              <div className="space-y-2">
                {unifiedResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 text-muted-foreground mt-1">
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {result.title}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {result.type}
                          </Badge>
                          {result.featured && (
                            <Badge variant="default" className="text-xs">
                              Featured
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {result.category}
                          </span>
                          {result.price !== undefined && result.price > 0 && (
                            <span className="text-xs font-medium text-foreground">
                              ${result.price}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Suggestions */}
      {showSuggestions && !showResults && !isAutofilling && (suggestions.length > 0 || recentSearches.length > 0) && (
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
      {showFiltersPanel && !isAutofilling && (
        <Card className="absolute top-full left-0 right-0 mt-2 shadow-lg z-40">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={filters.categories.length === 0 ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilters({ ...filters, categories: [] })}
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
                      onClick={() => setFilters({ ...filters, rating: filters.rating === rating ? 0 : rating })}
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
                        setFilters({ ...filters, tags: newTags });
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
                  onClick={() => setFilters({ ...filters, categories: [], rating: 0, tags: [] })}
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
