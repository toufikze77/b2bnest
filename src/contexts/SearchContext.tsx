
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Template, TemplateFilter } from '@/types/template';
import { templateService } from '@/services/templateService';
import { unifiedSearchService, SearchResult } from '@/services/unifiedSearchService';

interface SearchContextType {
  searchQuery: string;
  searchResults: Template[];
  unifiedResults: SearchResult[];
  filters: TemplateFilter;
  isSearching: boolean;
  suggestions: string[];
  recentSearches: string[];
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<TemplateFilter>) => void;
  performSearch: (query: string) => void;
  performUnifiedSearch: (query: string) => void;
  clearSearch: () => void;
  addToRecentSearches: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Template[]>([]);
  const [unifiedResults, setUnifiedResults] = useState<SearchResult[]>([]);
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

  const performUnifiedSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    
    try {
      const results = await unifiedSearchService.search(query, 20);
      setUnifiedResults(results);
    } catch (error) {
      console.error('Unified search error:', error);
      setUnifiedResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setUnifiedResults([]);
    setSuggestions([]);
  }, []);

  const addToRecentSearches = useCallback((query: string) => {
    if (query.trim() && !recentSearches.includes(query)) {
      setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
    }
  }, [recentSearches]);

  // Generate suggestions based on query
  React.useEffect(() => {
    if (searchQuery.length > 1) {
      const suggestions = unifiedSearchService.getSuggestions(searchQuery);
      setSuggestions(suggestions);
    } else if (searchQuery.length === 0) {
      setSuggestions(unifiedSearchService.getPopularSearches());
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  return (
    <SearchContext.Provider value={{
      searchQuery,
      searchResults,
      unifiedResults,
      filters,
      isSearching,
      suggestions,
      recentSearches,
      setSearchQuery,
      setFilters,
      performSearch,
      performUnifiedSearch,
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
