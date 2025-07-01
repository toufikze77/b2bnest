
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PaymentMethodSelector from './PaymentMethodSelector';
import { useToast } from '@/hooks/use-toast';

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

  const handlePaymentSuccess = (paymentData: any) => {
    console.log('Payment successful:', paymentData);
    toast({
      title: "Payment Successful!",
      description: `Your payment of £${amount.toFixed(2)} has been processed successfully.`,
    });
    
    onPaymentSuccess?.(paymentData);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Secure Checkout</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <PaymentMethodSelector
            amount={amount}
            currency={currency}
            itemName={itemName}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
