
import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Template, TemplateFilter } from '@/types/template';
import TemplateCard from './TemplateCard';
import AdvancedFilters from './AdvancedFilters';
import { useSearch } from '@/contexts/SearchContext';

interface SearchResultsProps {
  results: Template[];
  searchQuery: string;
  isLoading?: boolean;
}

const SearchResults = ({ results, searchQuery, isLoading = false }: SearchResultsProps) => {
  const { filters, setFilters } = useSearch();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handlePreview = (template: Template) => {
    // TODO: Implement preview functionality
    console.log('Preview template:', template.title);
  };

  const handleDownload = (template: Template) => {
    // TODO: Implement download/purchase functionality
    console.log('Download template:', template.title);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-white rounded-lg border p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded flex-1"></div>
                <div className="h-8 bg-gray-200 rounded flex-1"></div>
              </div>
            </div>
          </div>
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
      {/* Results header with filters */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          {searchQuery && results.length > 0 && (
            <p className="text-gray-600">
              Found <span className="font-semibold">{results.length}</span> results
              {searchQuery && (
                <>
                  {' '}for "<span className="font-semibold">{searchQuery}</span>"
                </>
              )}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="mb-6">
          <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClose={() => setShowAdvancedFilters(false)}
          />
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            searchQuery={searchQuery}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
