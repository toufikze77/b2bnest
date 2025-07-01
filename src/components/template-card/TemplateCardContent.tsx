
import React from 'react';
import { BadgeIcon, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';

interface TemplateCardContentProps {
  fileType: string;
  fileSize: string;
  version: string;
  licenseType: string;
  isRoyaltyFree: boolean;
  canResell: boolean;
  price: number;
  currency: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  downloads: number;
  difficulty: string;
  searchQuery?: string;
}

const TemplateCardContent = ({
  fileType,
  fileSize,
  version,
  licenseType,
  isRoyaltyFree,
  canResell,
  price,
  currency,
  tags,
  rating,
  reviewCount,
  downloads,
  difficulty,
  searchQuery = ''
}: TemplateCardContentProps) => {
  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `£${price.toFixed(2)}`;
  };

  const getLicenseBadgeColor = (licenseType: string) => {
    switch (licenseType) {
      case 'Free': return 'bg-green-100 text-green-800';
      case 'Premium': return 'bg-blue-100 text-blue-800';
      case 'Enterprise': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
    <CardContent className="pt-0">
      {/* File info */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <BadgeIcon className="h-3 w-3" />
          {fileType}
        </span>
        <span>{fileSize}</span>
        <span>v{version}</span>
      </div>

      {/* License and pricing */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${getLicenseBadgeColor(licenseType)}`}>
            {licenseType}
          </Badge>
          {isRoyaltyFree && (
            <Badge variant="outline" className="text-xs text-green-600">
              Royalty-Free
            </Badge>
          )}
          {canResell && (
            <Badge variant="outline" className="text-xs text-blue-600">
              Resale OK
            </Badge>
          )}
        </div>
        <div className="text-lg font-bold text-green-600">
          {formatPrice(price)}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-4">
        {tags.slice(0, 3).map((tag, index) => (
          <Badge key={index} variant="secondary" className="text-xs">
            {highlightText(tag, searchQuery)}
          </Badge>
        ))}
        {tags.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{tags.length - 3} more
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)} ({reviewCount})
          </span>
          <span>{downloads.toLocaleString()} downloads</span>
        </div>
        <span className="text-xs">{difficulty}</span>
      </div>
    </CardContent>
  );
};

export default TemplateCardContent;
