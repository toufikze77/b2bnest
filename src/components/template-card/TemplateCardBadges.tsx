
import React from 'react';
import { Crown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TemplateCardBadgesProps {
  featured?: boolean;
  trending?: boolean;
  isNew?: boolean;
}

const TemplateCardBadges = ({ featured, trending, isNew }: TemplateCardBadgesProps) => {
  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
      {featured && (
        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
          <Crown className="h-3 w-3 mr-1" />
          Featured
        </Badge>
      )}
      {trending && (
        <Badge className="bg-red-100 text-red-800 text-xs">
          <TrendingUp className="h-3 w-3 mr-1" />
          Trending
        </Badge>
      )}
      {isNew && (
        <Badge className="bg-green-100 text-green-800 text-xs">
          New
        </Badge>
      )}
    </div>
  );
};

export default TemplateCardBadges;
