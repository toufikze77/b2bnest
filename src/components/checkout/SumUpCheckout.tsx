import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SumUpCheckoutProps {
  amount: number;
  currency: string;
  itemName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const SumUpCheckout = ({
  amount,
  currency,
  itemName,
  onSuccess,
  onError,
  onCancel
}: SumUpCheckoutProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Ensure user is authenticated before proceeding
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onError('User not authenticated. Please sign in and try again.');
        return;
      }

      const returnUrl = `${window.location.origin}/payment-success`;
      
      const { data, error } = await supabase.functions.invoke('create-sumup-checkout', {
        body: {
          amount: amount,
          currency: currency,
          itemName: itemName,
          returnUrl: returnUrl
        }
      });

      if (error) {
        console.error('SumUp checkout error:', error);
        onError(error.message || 'Failed to create checkout');
        return;
      }

      if (data?.checkout_url) {
        // Open SumUp checkout in a new tab
        window.open(data.checkout_url, '_blank');
        
        // For demo purposes, simulate successful payment after a delay
        toast({
          title: "Payment Initiated",
          description: "Complete your payment in the new tab",
        });
        
        // In a real implementation, you'd want to poll for payment status
        // or use webhooks to confirm payment completion
        setTimeout(async () => {
          // Verify user is still authenticated before calling success
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            onSuccess({
              id: data.id,
              status: 'completed',
              amount: amount,
              currency: currency
            });
          } else {
            onError('Authentication expired. Please sign in again.');
          }
        }, 3000);
      } else {
        onError('Failed to create SumUp checkout');
      }
    } catch (error) {
      console.error('Payment error:', error);
      onError('Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          SumUp Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-green-600">
            £{amount.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">{itemName}</div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handlePayment}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            size="lg"
            disabled={loading}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            {loading ? 'Processing...' : 'Pay with SumUp'}
          </Button>

          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payment Methods
          </Button>
        </div>

        <div className="text-center text-xs text-gray-500 mt-4">
          Secure payments powered by SumUp
        </div>
      </CardContent>
    </Card>
  );
};

export default SumUpCheckout;