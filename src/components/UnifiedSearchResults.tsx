import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, FileText, Settings, Sparkles, ExternalLink, Star } from 'lucide-react';
import { SearchResult } from '@/services/unifiedSearchService';

interface UnifiedSearchResultsProps {
  results: SearchResult[];
  searchQuery: string;
  isLoading?: boolean;
  onResultClick?: (result: SearchResult) => void;
}

const UnifiedSearchResults = ({ 
  results, 
  searchQuery, 
  isLoading = false,
  onResultClick 
}: UnifiedSearchResultsProps) => {
  const navigate = useNavigate();

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
      return;
    }

    // Default navigation behavior
    if (result.url) {
      if (result.url.startsWith('/')) {
        navigate(result.url);
      } else {
        window.open(result.url, '_blank');
      }
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'tool': return <Settings className="h-5 w-5 text-blue-500" />;
      case 'document': return <FileText className="h-5 w-5 text-green-500" />;
      case 'template': return <Sparkles className="h-5 w-5 text-purple-500" />;
      default: return <Search className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tool': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'document': return 'bg-green-50 text-green-700 border-green-200';
      case 'template': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No results found
          </h3>
          <p className="text-gray-500 mb-4">
            We couldn't find anything matching "{searchQuery}". Try searching for:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline">Invoice Generator</Badge>
            <Badge variant="outline">Contract Templates</Badge>
            <Badge variant="outline">CRM System</Badge>
            <Badge variant="outline">AI Workspace</Badge>
            <Badge variant="outline">Business Cards</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Search Results ({results.length})
        </h2>
        <div className="text-sm text-gray-500">
          Found {results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"
        </div>
      </div>

      <div className="grid gap-4">
        {results.map((result) => (
          <Card 
            key={result.id} 
            className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
            onClick={() => handleResultClick(result)}
          >
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                {/* Icon/Thumbnail */}
                <div className="flex-shrink-0">
                  {result.thumbnail && !result.thumbnail.includes('emoji') ? (
                    <img 
                      src={result.thumbnail} 
                      alt={result.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      {result.thumbnail?.includes('emoji') ? (
                        <span className="text-2xl">{result.thumbnail}</span>
                      ) : (
                        getResultIcon(result.type)
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {result.title}
                      </h3>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getTypeColor(result.type)}`}
                      >
                        {result.type}
                      </Badge>
                      {result.featured && (
                        <Badge variant="default" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                    </div>
                    
                    {result.url && (
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>

                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {result.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="font-medium">{result.category}</span>
                      {result.rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>{result.rating}</span>
                        </div>
                      )}
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex space-x-1">
                          {result.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {result.tags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{result.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {result.price !== undefined && result.price > 0 ? (
                        <span className="text-lg font-bold text-green-600">
                          ${result.price}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Free
                        </Badge>
                      )}
                      
                      <Button 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResultClick(result);
                        }}
                      >
                        {result.type === 'tool' ? 'Open Tool' : 
                         result.type === 'document' ? 'View Document' : 
                         'Use Template'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default UnifiedSearchResults;