
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Template, TemplateFilter } from '@/types/template';
import { templateService } from '@/services/templateService';

interface SearchContextType {
  searchQuery: string;
  searchResults: Template[];
  filters: TemplateFilter;
  isSearching: boolean;
  suggestions: string[];
  recentSearches: string[];
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<TemplateFilter>) => void;
  performSearch: (query: string) => void;
  clearSearch: () => void;
  addToRecentSearches: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Template[]>([]);
  const [filters, setFiltersState] = useState<TemplateFilter>({
    categories: [],
    licenses: [],
    priceRange: [0, 100],
    fileTypes: [],
    tags: [],
    rating: 0,
    isRoyaltyFree: undefined,
    canResell: undefined,
    featured: undefined,
    trending: undefined
  });
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const setFilters = useCallback((newFilters: Partial<TemplateFilter>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFiltersState(updatedFilters);
    
    // Re-run search with new filters
    if (searchQuery) {
      const results = templateService.searchTemplates(searchQuery, updatedFilters);
      setSearchResults(results);
    }
  }, [filters, searchQuery]);

  const performSearch = useCallback((query: string) => {
    setIsSearching(true);
    
    setTimeout(() => {
      const results = templateService.searchTemplates(query, filters);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, [filters]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSuggestions([]);
  }, []);

  const addToRecentSearches = useCallback((query: string) => {
    if (query.trim() && !recentSearches.includes(query)) {
      setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
    }
  }, [recentSearches]);

  // Generate suggestions based on query
  React.useEffect(() => {
    if (searchQuery.length > 0) {
      const commonSuggestions = [
        'Non-Disclosure Agreement',
        'Invoice Template',
        'Business Plan',
        'Employee Contract',
        'Service Agreement',
        'Expense Report',
        'Legal Forms',
        'HR Documents',
        'Financial Templates',
        'Social Media Calendar',
        'Marketing Materials',
        'Onboarding Checklist'
      ];
      
      const filtered = commonSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(searchQuery.toLowerCase()) &&
        suggestion.toLowerCase() !== searchQuery.toLowerCase()
      ).slice(0, 5);
      
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  return (
    <SearchContext.Provider value={{
      searchQuery,
      searchResults,
      filters,
      isSearching,
      suggestions,
      recentSearches,
      setSearchQuery,
      setFilters,
      performSearch,
      clearSearch,
      addToRecentSearches
    }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
