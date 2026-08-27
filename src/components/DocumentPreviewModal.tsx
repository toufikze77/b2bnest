
import React from 'react';
import { X, Download, Heart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Template } from '@/types/template';
import TemplateThumbnail from '@/components/template-center/TemplateThumbnail';


interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onDownload?: (template: Template) => void;
  onToggleFavorite?: (template: Template) => void;
  isFavorite?: boolean;
}

const DocumentPreviewModal = ({ 
  isOpen, 
  onClose, 
  template, 
  onDownload, 
  onToggleFavorite, 
  isFavorite = false 
}: DocumentPreviewModalProps) => {
  if (!template) return null;

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `£${price.toFixed(2)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{template.title}</DialogTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{template.category.name}</Badge>
                {template.subcategory && (
                  <Badge variant="secondary">{template.subcategory}</Badge>
                )}
                <Badge className="bg-green-100 text-green-800">
                  {formatPrice(template.price)}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto rounded-lg bg-muted/40 p-6">
          <div className="mx-auto h-full w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-bold">{template.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {template.category.name}
              {template.subcategory ? ` · ${template.subcategory}` : ''} · v{template.version}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">{template.description}</p>
            <div className="mt-6 h-40">
              <TemplateThumbnail seed={template.id} title={template.title} />
            </div>
            <p className="mt-6 text-sm font-semibold">What you get</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {template.tags.slice(0, 5).map((tag) => (
                <li key={tag} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Ready-to-edit {tag.toLowerCase()} section
                </li>
              ))}
            </ul>
            {template.instructions && (
              <p className="mt-4 text-xs text-muted-foreground">{template.instructions}</p>
            )}
          </div>
        </div>


        {/* Document Details */}
        <div className="flex-shrink-0 bg-gray-50 rounded-lg p-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Details</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">File Type:</span> {template.fileType}</p>
                <p><span className="font-medium">File Size:</span> {template.fileSize}</p>
                <p><span className="font-medium">Version:</span> {template.version}</p>
                <p><span className="font-medium">Downloads:</span> {template.downloads.toLocaleString()}</p>
                <p><span className="font-medium">Rating:</span> {template.rating.toFixed(1)} ({template.reviewCount} reviews)</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => onDownload?.(template)}
            >
              <Download className="h-4 w-4 mr-2" />
              {template.price === 0 ? 'Download Free' : `Buy Now - ${formatPrice(template.price)}`}
            </Button>
            <Button
              variant="outline"
              onClick={() => onToggleFavorite?.(template)}
              className={isFavorite ? 'text-red-500 border-red-200' : ''}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="outline">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewModal;
