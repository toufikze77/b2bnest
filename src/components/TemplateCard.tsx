
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Template } from '@/types/template';
import CheckoutModal from './checkout/CheckoutModal';
import DocumentPreviewModal from './DocumentPreviewModal';
import { userDocumentService } from '@/services/userDocumentService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TemplateCardBadges from './template-card/TemplateCardBadges';
import TemplateCardHeader from './template-card/TemplateCardHeader';
import TemplateCardContent from './template-card/TemplateCardContent';
import TemplateCardActions from './template-card/TemplateCardActions';

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
      // Double-check authentication before adding purchase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Payment Successful",
          description: "Your payment was processed. Please sign in to access your purchase.",
          variant: "destructive"
        });
        return;
      }

      await userDocumentService.addPurchase(template.id);
      toast({
        title: "Purchase Successful",
        description: "Document has been added to your library."
      });
      onDownload?.(template);
    } catch (error) {
      console.error('Error adding purchase:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('not authenticated')) {
        toast({
          title: "Payment Complete - Sign In Required",
          description: "Your payment was successful. Please sign in to access your purchase.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Purchase Complete",
          description: "Your payment was successful. You can now download the document.",
          variant: "default"
        });
        onDownload?.(template);
      }
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
        <TemplateCardBadges
          featured={template.featured}
          trending={template.trending}
          isNew={template.isNew}
        />

        <TemplateCardHeader
          title={template.title}
          description={template.description}
          categoryName={template.category.name}
          subcategory={template.subcategory}
          searchQuery={searchQuery}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
        />
        
        <TemplateCardContent
          fileType={template.fileType}
          fileSize={template.fileSize}
          version={template.version}
          licenseType={template.license.type}
          isRoyaltyFree={template.isRoyaltyFree}
          canResell={template.canResell}
          price={template.price}
          currency={template.currency}
          tags={template.tags}
          rating={template.rating}
          reviewCount={template.reviewCount}
          downloads={template.downloads}
          difficulty={template.difficulty}
          searchQuery={searchQuery}
        />

        <TemplateCardActions
          price={template.price}
          onPreview={handlePreview}
          onPurchase={handlePurchase}
        />
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
