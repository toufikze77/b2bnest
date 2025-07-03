
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CreditCard } from 'lucide-react';

interface PayPalCheckoutProps {
  amount: number;
  currency: string;
  itemName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

const PayPalCheckout = ({
  amount,
  currency,
  itemName,
  onSuccess,
  onError,
  onCancel
}: PayPalCheckoutProps) => {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const loadPayPalScript = () => {
      console.log('Loading PayPal script...');
      if (window.paypal) {
        console.log('PayPal already loaded');
        initializePayPal();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.paypal.com/sdk/js?client-id=AQOxY2Z0_8hf62chNGkI8NVxl1h42QJC_tSBPAAM7_cHnUI3fNYdKNfOLiR5cvrv1Vs2YZ0f4zBx3hVz&currency=GBP&components=buttons';
      script.async = true;
      script.onload = () => {
        console.log('PayPal script loaded successfully');
        initializePayPal();
      };
      script.onerror = (error) => {
        console.error('Failed to load PayPal script:', error);
        setError('Failed to load PayPal SDK');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    const initializePayPal = () => {
      if (!window.paypal || !paypalRef.current) {
        setError('PayPal SDK not available');
        setIsLoading(false);
        return;
      }

      try {
        window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                amount: {
                  value: amount.toFixed(2),
                  currency_code: currency === 'GBP' ? 'GBP' : 'USD'
                },
                description: itemName
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const order = await actions.order.capture();
              console.log('PayPal payment successful:', order);
              onSuccess({
                orderId: order.id,
                paymentMethod: 'paypal',
                amount: amount,
                currency: currency,
                payerEmail: order.payer?.email_address
              });
            } catch (error) {
              console.error('PayPal capture error:', error);
              onError('Payment capture failed');
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            onError('PayPal payment failed');
          },
          onCancel: () => {
            console.log('PayPal payment cancelled');
            onCancel();
          }
        }).render(paypalRef.current);

        setIsLoading(false);
      } catch (error) {
        console.error('PayPal initialization error:', error);
        setError('Failed to initialize PayPal');
        setIsLoading(false);
      }
    };

    loadPayPalScript();
  }, [amount, currency, itemName, onSuccess, onError, onCancel]);

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <CreditCard className="h-5 w-5" />
            PayPal Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-red-600">{error}</p>
          <Button onClick={onCancel} variant="outline" className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payment Methods
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          PayPal Checkout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-green-600">
            £{amount.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">{itemName}</div>
        </div>

        <Button onClick={onCancel} variant="outline" className="w-full mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payment Methods
        </Button>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading PayPal...</span>
          </div>
        ) : (
          <div ref={paypalRef} className="w-full" />
        )}
      </CardContent>
    </Card>
  );
};

export default PayPalCheckout;
