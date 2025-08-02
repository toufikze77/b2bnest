
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PaymentMethodSelector from './PaymentMethodSelector';
import BuyerInformationForm from './BuyerInformationForm';
import { useToast } from '@/hooks/use-toast';

interface BuyerInformation {
  fullName: string;
  companyName: string;
  email: string;
  contactNumber: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
  itemName: string;
  onPaymentSuccess?: (paymentData: any) => void;
}

const CheckoutModal = ({
  isOpen,
  onClose,
  amount,
  currency,
  itemName,
  onPaymentSuccess
}: CheckoutModalProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<'info' | 'payment'>('info');
  const [buyerInfo, setBuyerInfo] = useState<BuyerInformation | null>(null);

  // Reset step when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep('info');
      setBuyerInfo(null);
    }
  }, [isOpen]);

  const handleBuyerInfoSubmit = (info: BuyerInformation) => {
    setBuyerInfo(info);
    setCurrentStep('payment');
  };

  const handleBackToInfo = () => {
    setCurrentStep('info');
  };

  const handlePaymentSuccess = (paymentData: any) => {
    console.log('Payment successful:', paymentData);
    console.log('Buyer information:', buyerInfo);
    
    toast({
      title: "Payment Successful!",
      description: `Your payment of ${currency === 'GBP' ? '£' : '$'}${amount.toFixed(2)} has been processed successfully.`,
    });
    
    // Include buyer information in payment success callback
    onPaymentSuccess?.({ ...paymentData, buyerInfo });
    onClose();
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  const handleClose = () => {
    setCurrentStep('info');
    setBuyerInfo(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {currentStep === 'info' ? 'Buyer Information' : 'Secure Checkout'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {currentStep === 'info' ? (
            <BuyerInformationForm
              onSubmit={handleBuyerInfoSubmit}
              onBack={handleClose}
              itemName={itemName}
              amount={amount}
              currency={currency}
            />
          ) : (
            <div className="space-y-4">
              {/* Buyer Info Summary */}
              {buyerInfo && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Buyer Details:</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Name:</span> {buyerInfo.fullName}</p>
                    <p><span className="font-medium">Company:</span> {buyerInfo.companyName}</p>
                    <p><span className="font-medium">Email:</span> {buyerInfo.email}</p>
                    <p><span className="font-medium">Phone:</span> {buyerInfo.contactNumber}</p>
                  </div>
                  <button
                    onClick={handleBackToInfo}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit information
                  </button>
                </div>
              )}
              
              <PaymentMethodSelector
                amount={amount}
                currency={currency}
                itemName={itemName}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                buyerInfo={buyerInfo}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
