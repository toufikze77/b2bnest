import React, { useState, useEffect } from 'react';
import { Download, Eye, Star, Crown, TrendingUp, Badge as BadgeIcon, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Template } from '@/types/template';
import CheckoutModal from './checkout/CheckoutModal';
import DocumentPreviewModal from './DocumentPreviewModal';
import { userDocumentService } from '@/services/userDocumentService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface TemplateCardProps {
  template: Template;
  searchQuery?: string;
  onPreview?: (template: Template) => void;
  onDownload?: (template: Template) => void;
}

const TemplateCard = ({ template, searchQuery = '', onPreview, onDownload }: TemplateCardProps) => {
  const { user } = useAuth();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (user) {
      checkFavoriteStatus();
    }
  }, [user, template.id]);

  const checkFavoriteStatus = async () => {
    try {
      const favoriteStatus = await userDocumentService.checkIfFavorite(template.id);
      setIsFavorite(favoriteStatus);
    } catch (error) {
      console.error('Error checking favorite status:', error);
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

  const formatPrice = (price: number, currency: string) => {
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

  const handlePurchase = () => {
    if (template.price === 0) {
      onDownload?.(template);
    } else {
      setIsCheckoutOpen(true);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    console.log('Payment completed for template:', template.id, paymentData);
    
    try {
      // Add to user's purchases
      await userDocumentService.addPurchase(template.id);
      toast({
        title: "Purchase Successful",
        description: "Document has been added to your library."
      });
      onDownload?.(template);
    } catch (error) {
      console.error('Error adding purchase:', error);
      toast({
        title: "Purchase Complete",
        description: "Your payment was successful. You can now download the document.",
        variant: "default"
      });
      onDownload?.(template);
    }
  };

  const handlePreview = () => {
    setIsPreviewOpen(true);
    onPreview?.(template);
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to add favorites.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isFavorite) {
        await userDocumentService.removeFromFavorites(template.id);
        setIsFavorite(false);
        toast({
          title: "Removed from Favorites",
          description: "Template removed from your favorites."
        });
      } else {
        await userDocumentService.addToFavorites(template.id);
        setIsFavorite(true);
        toast({
          title: "Added to Favorites",
          description: "Template added to your favorites."
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorites.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow relative group">
        {/* Status badges */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          {template.featured && (
            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
              <Crown className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
          {template.trending && (
            <Badge className="bg-red-100 text-red-800 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending
            </Badge>
          )}
          {template.isNew && (
            <Badge className="bg-green-100 text-green-800 text-xs">
              New
            </Badge>
          )}
        </div>

        {/* Favorite button */}
        <div className="absolute top-3 left-3 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavorite}
            className={`p-2 h-8 w-8 ${isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-16">
              <CardTitle className="text-lg mb-2 line-clamp-2">
                {highlightText(template.title, searchQuery)}
              </CardTitle>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {template.category.name}
                </Badge>
                {template.subcategory && (
                  <Badge variant="secondary" className="text-xs">
                    {template.subcategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <CardDescription className="line-clamp-2">
            {highlightText(template.description, searchQuery)}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* File info */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <span className="flex items-center gap-1">
              <BadgeIcon className="h-3 w-3" />
              {template.fileType}
            </span>
            <span>{template.fileSize}</span>
            <span>v{template.version}</span>
          </div>

          {/* License and pricing */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${getLicenseBadgeColor(template.license.type)}`}>
                {template.license.type}
              </Badge>
              {template.isRoyaltyFree && (
                <Badge variant="outline" className="text-xs text-green-600">
                  Royalty-Free
                </Badge>
              )}
              {template.canResell && (
                <Badge variant="outline" className="text-xs text-blue-600">
                  Resale OK
                </Badge>
              )}
            </div>
            <div className="text-lg font-bold text-green-600">
              {formatPrice(template.price, template.currency)}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-4">
            {template.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {highlightText(tag, searchQuery)}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3} more
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {template.rating.toFixed(1)} ({template.reviewCount})
              </span>
              <span>{template.downloads.toLocaleString()} downloads</span>
            </div>
            <span className="text-xs">{template.difficulty}</span>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={handlePurchase}
            >
              <Download className="h-4 w-4 mr-1" />
              {template.price === 0 ? 'Download' : 'Buy Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        amount={template.price}
        currency={template.currency}
        itemName={template.title}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        template={template}
        onDownload={handlePurchase}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={isFavorite}
      />
    </>
  );
};

export default TemplateCard;
