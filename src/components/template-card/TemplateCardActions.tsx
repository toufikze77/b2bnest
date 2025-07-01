
import React from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplateCardActionsProps {
  price: number;
  onPreview: () => void;
  onPurchase: () => void;
}

const TemplateCardActions = ({ price, onPreview, onPurchase }: TemplateCardActionsProps) => {
  return (
    <div className="flex gap-2 px-6 pb-6">
      <Button 
        size="sm" 
        variant="outline" 
        className="flex-1"
        onClick={onPreview}
      >
        <Eye className="h-4 w-4 mr-1" />
        Preview
      </Button>
      <Button 
        size="sm" 
        className="flex-1"
        onClick={onPurchase}
      >
        <Download className="h-4 w-4 mr-1" />
        {price === 0 ? 'Download' : 'Buy Now'}
      </Button>
    </div>
  );
};

export default TemplateCardActions;
