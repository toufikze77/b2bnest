
import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { TemplateFilter } from '@/types/template';
import { templateCategories, templateLicenses } from '@/data/templateData';

interface AdvancedFiltersProps {
  filters: TemplateFilter;
  onFiltersChange: (filters: TemplateFilter) => void;
  onClose: () => void;
}

const AdvancedFilters = ({ filters, onFiltersChange, onClose }: AdvancedFiltersProps) => {
  const fileTypes = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'ZIP'];
  const popularTags = ['Contract', 'Template', 'Professional', 'Business', 'Legal', 'HR', 'Finance', 'Marketing'];

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, categoryId]
      : filters.categories.filter(id => id !== categoryId);
    
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleLicenseChange = (licenseType: string, checked: boolean) => {
    const newLicenses = checked
      ? [...filters.licenses, licenseType]
      : filters.licenses.filter(type => type !== licenseType);
    
    onFiltersChange({ ...filters, licenses: newLicenses });
  };

  const handleFileTypeChange = (fileType: string, checked: boolean) => {
    const newFileTypes = checked
      ? [...filters.fileTypes, fileType]
      : filters.fileTypes.filter(type => type !== fileType);
    
    onFiltersChange({ ...filters, fileTypes: newFileTypes });
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    const newTags = checked
      ? [...filters.tags, tag]
      : filters.tags.filter(t => t !== tag);
    
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handlePriceRangeChange = (value: number[]) => {
    onFiltersChange({ ...filters, priceRange: [value[0], value[1]] });
  };

  const clearAllFilters = () => {
    onFiltersChange({
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
  };

  const getActiveFilterCount = () => {
    return filters.categories.length + 
           filters.licenses.length + 
           filters.fileTypes.length + 
           filters.tags.length + 
           (filters.rating > 0 ? 1 : 0) +
           (filters.isRoyaltyFree !== undefined ? 1 : 0) +
           (filters.canResell !== undefined ? 1 : 0) +
           (filters.featured !== undefined ? 1 : 0) +
           (filters.trending !== undefined ? 1 : 0);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Advanced Filters
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="ml-2">
              {getActiveFilterCount()} active
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Categories */}
        <div>
          <h4 className="font-medium mb-3">Categories</h4>
          <div className="grid grid-cols-2 gap-3">
            {templateCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={(checked) => handleCategoryChange(category.id, checked as boolean)}
                />
                <label htmlFor={`category-${category.id}`} className="text-sm">
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* License Types */}
        <div>
          <h4 className="font-medium mb-3">License Types</h4>
          <div className="flex flex-wrap gap-3">
            {templateLicenses.map((license) => (
              <div key={license.type} className="flex items-center space-x-2">
                <Checkbox
                  id={`license-${license.type}`}
                  checked={filters.licenses.includes(license.type)}
                  onCheckedChange={(checked) => handleLicenseChange(license.type, checked as boolean)}
                />
                <label htmlFor={`license-${license.type}`} className="text-sm">
                  {license.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <h4 className="font-medium mb-3">
            Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
          </h4>
          <Slider
            value={filters.priceRange}
            onValueChange={handlePriceRangeChange}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* File Types */}
        <div>
          <h4 className="font-medium mb-3">File Types</h4>
          <div className="flex flex-wrap gap-3">
            {fileTypes.map((fileType) => (
              <div key={fileType} className="flex items-center space-x-2">
                <Checkbox
                  id={`filetype-${fileType}`}
                  checked={filters.fileTypes.includes(fileType)}
                  onCheckedChange={(checked) => handleFileTypeChange(fileType, checked as boolean)}
                />
                <label htmlFor={`filetype-${fileType}`} className="text-sm">
                  {fileType}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Special Features */}
        <div>
          <h4 className="font-medium mb-3">Special Features</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="royalty-free"
                checked={filters.isRoyaltyFree === true}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, isRoyaltyFree: checked ? true : undefined })
                }
              />
              <label htmlFor="royalty-free" className="text-sm">Royalty-Free</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="can-resell"
                checked={filters.canResell === true}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, canResell: checked ? true : undefined })
                }
              />
              <label htmlFor="can-resell" className="text-sm">Resale Rights</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="featured"
                checked={filters.featured === true}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, featured: checked ? true : undefined })
                }
              />
              <label htmlFor="featured" className="text-sm">Featured</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trending"
                checked={filters.trending === true}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, trending: checked ? true : undefined })
                }
              />
              <label htmlFor="trending" className="text-sm">Trending</label>
            </div>
          </div>
        </div>

        {/* Minimum Rating */}
        <div>
          <h4 className="font-medium mb-3">Minimum Rating</h4>
          <div className="flex gap-2">
            {[0, 3, 4, 4.5].map((rating) => (
              <Badge
                key={rating}
                variant={filters.rating === rating ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, rating: filters.rating === rating ? 0 : rating })}
              >
                {rating === 0 ? 'Any' : `${rating}+ ★`}
              </Badge>
            ))}
          </div>
        </div>

        {/* Popular Tags */}
        <div>
          <h4 className="font-medium mb-3">Popular Tags</h4>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Badge
                key={tag}
                variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleTagChange(tag, !filters.tags.includes(tag))}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={clearAllFilters}>
            Clear All Filters
          </Button>
          <Button onClick={onClose}>
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedFilters;
