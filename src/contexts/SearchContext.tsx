
import React, { createContext, useContext, useState, useCallback } from 'react';

interface SearchFilters {
  category: string;
  rating: number;
  downloads: number;
  tags: string[];
}

interface SearchResult {
  id: number;
  title: string;
  category: string;
  description: string;
  downloads: number;
  rating: number;
  tags: string[];
  relevanceScore?: number;
}

interface SearchContextType {
  searchQuery: string;
  searchResults: SearchResult[];
  filters: SearchFilters;
  isSearching: boolean;
  suggestions: string[];
  recentSearches: string[];
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  performSearch: (query: string, data: SearchResult[]) => void;
  clearSearch: () => void;
  addToRecentSearches: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [filters, setFiltersState] = useState<SearchFilters>({
    category: '',
    rating: 0,
    downloads: 0,
    tags: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const setFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const calculateRelevanceScore = useCallback((item: SearchResult, query: string): number => {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Title match (highest weight)
    if (item.title.toLowerCase().includes(queryLower)) {
      score += 10;
      if (item.title.toLowerCase().startsWith(queryLower)) {
        score += 5;
      }
    }
    
    // Description match
    if (item.description.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    
    // Tag matches
    const matchingTags = item.tags.filter(tag => 
      tag.toLowerCase().includes(queryLower)
    ).length;
    score += matchingTags * 3;
    
    // Category match
    if (item.category.toLowerCase().includes(queryLower)) {
      score += 4;
    }
    
    // Popularity boost (based on downloads and rating)
    score += (item.rating / 5) * 2;
    score += Math.log10(item.downloads + 1) * 0.5;
    
    return score;
  }, []);

  const performSearch = useCallback((query: string, data: SearchResult[]) => {
    setIsSearching(true);
    
    // Simulate search delay for realistic UX
    setTimeout(() => {
      if (!query.trim()) {
        setSearchResults(data);
        setIsSearching(false);
        return;
      }

      const queryLower = query.toLowerCase();
      
      // Filter and score results
      let filtered = data.filter(item => {
        // Text matching
        const textMatch = 
          item.title.toLowerCase().includes(queryLower) ||
          item.description.toLowerCase().includes(queryLower) ||
          item.category.toLowerCase().includes(queryLower) ||
          item.tags.some(tag => tag.toLowerCase().includes(queryLower));

        if (!textMatch) return false;

        // Apply filters
        if (filters.category && item.category !== filters.category) return false;
        if (filters.rating && item.rating < filters.rating) return false;
        if (filters.downloads && item.downloads < filters.downloads) return false;
        if (filters.tags.length > 0 && !filters.tags.some(tag => 
          item.tags.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
        )) return false;

        return true;
      });

      // Calculate relevance scores and sort
      filtered = filtered.map(item => ({
        ...item,
        relevanceScore: calculateRelevanceScore(item, query)
      })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      setSearchResults(filtered);
      setIsSearching(false);
    }, 300);
  }, [filters, calculateRelevanceScore]);

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
        'Financial Templates'
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
