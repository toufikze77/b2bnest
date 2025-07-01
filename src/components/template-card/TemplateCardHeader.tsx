
import React from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface TemplateCardHeaderProps {
  title: string;
  description: string;
  categoryName: string;
  subcategory?: string;
  searchQuery?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const TemplateCardHeader = ({
  title,
  description,
  categoryName,
  subcategory,
  searchQuery = '',
  isFavorite,
  onToggleFavorite
}: TemplateCardHeaderProps) => {
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

  return (
    <>
      <div className="absolute top-3 left-3 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFavorite}
          className={`p-2 h-8 w-8 ${isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-16">
            <CardTitle className="text-lg mb-2 line-clamp-2">
              {highlightText(title, searchQuery)}
            </CardTitle>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {categoryName}
              </Badge>
              {subcategory && (
                <Badge variant="secondary" className="text-xs">
                  {subcategory}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <CardDescription className="line-clamp-2">
          {highlightText(description, searchQuery)}
        </CardDescription>
      </CardHeader>
    </>
  );
};

export default TemplateCardHeader;
