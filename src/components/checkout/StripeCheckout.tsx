import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StripeCheckoutProps {
  amount: number;
  currency: string;
  itemName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  buyerInfo?: {
    fullName: string;
    companyName: string;
    email: string;
    contactNumber: string;
  } | null;
}

const StripeCheckout = ({
  amount,
  currency,
  itemName,
  onSuccess,
  onError,
  onCancel,
  buyerInfo
}: StripeCheckoutProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      // For anonymous users, we'll need to handle this differently
      // The buyer information should be available from the CheckoutModal context
      
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          itemName: itemName,
          // Include user info if available, otherwise payment will use guest flow
          isAuthenticated: !!user,
          buyerInfo: buyerInfo,
        }
      });

      if (error) {
        console.error('Stripe payment error:', error);
        onError(error.message || 'Failed to create payment session');
        return;
      }

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        onError('Failed to create Stripe payment session');
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
          Stripe Payment
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
            {loading ? 'Processing...' : 'Pay with Stripe'}
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
          Secure payments powered by Stripe
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeCheckout;