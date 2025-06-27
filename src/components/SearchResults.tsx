
import React from 'react';
import { Download, Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

interface SearchResultsProps {
  results: SearchResult[];
  searchQuery: string;
  isLoading?: boolean;
}

const SearchResults = ({ results, searchQuery, isLoading = false }: SearchResultsProps) => {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0 && searchQuery) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No results found for "{searchQuery}"
        </h3>
        <p className="text-gray-500 mb-6">
          Try adjusting your search terms or filters
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>Suggestions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Check your spelling</li>
            <li>Use more general terms</li>
            <li>Try different keywords</li>
            <li>Remove some filters</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {searchQuery && results.length > 0 && (
        <div className="flex items-center justify-between border-b pb-4">
          <p className="text-gray-600">
            Found <span className="font-semibold">{results.length}</span> results for "
            <span className="font-semibold">{searchQuery}</span>"
          </p>
          <div className="text-sm text-gray-500">
            Sorted by relevance
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((form) => (
          <Card key={form.id} className="hover:shadow-lg transition-shadow relative">
            {form.relevanceScore && form.relevanceScore > 15 && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                  <Star className="h-3 w-3 mr-1" />
                  Best Match
                </Badge>
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">
                    {highlightText(form.title, searchQuery)}
                  </CardTitle>
                  <Badge variant="outline" className="mb-2">
                    {form.category}
                  </Badge>
                </div>
                <div className="text-right text-sm text-gray-500 ml-4">
                  ★ {form.rating}
                </div>
              </div>
              <CardDescription>
                {highlightText(form.description, searchQuery)}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4">
                {form.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {highlightText(tag, searchQuery)}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {form.downloads.toLocaleString()} downloads
                </span>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Use
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
