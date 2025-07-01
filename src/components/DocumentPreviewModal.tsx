
import React from 'react';
import { X, Download, Heart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Template } from '@/types/template';

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
        <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-hidden">
          {template.previewUrl ? (
            <div className="h-full w-full bg-white rounded border">
              <iframe
                src={template.previewUrl}
                className="w-full h-full rounded"
                title={`Preview of ${template.title}`}
              />
            </div>
          ) : template.thumbnailUrl ? (
            <div className="h-full flex items-center justify-center">
              <img
                src={template.thumbnailUrl}
                alt={`Preview of ${template.title}`}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">Preview not available</p>
                <p className="text-sm">Download to view the full document</p>
              </div>
            </div>
          )}
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
