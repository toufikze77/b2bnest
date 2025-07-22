import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ArrowLeft, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CoinbaseCheckoutProps {
  amount: number;
  itemName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const CoinbaseCheckout = ({
  amount,
  itemName,
  onSuccess,
  onError,
  onCancel
}: CoinbaseCheckoutProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const createCoinbaseCharge = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-coinbase-charge', {
        body: {
          amount: amount,
          currency: 'USD',
          name: itemName,
          description: `Payment for ${itemName}`
        }
      });

      if (error) throw error;

      if (data.hosted_url) {
        setCheckoutUrl(data.hosted_url);
      } else {
        throw new Error('Failed to create Coinbase charge');
      }
    } catch (error) {
      console.error('Coinbase charge creation failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to create crypto payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
      // Simulate success for demo - in real implementation, you'd use webhooks
      setTimeout(() => {
        onSuccess({ 
          provider: 'coinbase',
          amount,
          currency: 'USD',
          item: itemName 
        });
      }, 2000);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Crypto Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-green-600">
            ${amount.toFixed(2)} USD
          </div>
          <div className="text-sm text-gray-600">{itemName}</div>
        </div>

        {!checkoutUrl ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                Pay with cryptocurrency using Coinbase Commerce
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Bitcoin (BTC)</li>
                <li>• Ethereum (ETH)</li>
                <li>• Litecoin (LTC)</li>
                <li>• Bitcoin Cash (BCH)</li>
              </ul>
            </div>

            <Button
              onClick={createCoinbaseCharge}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                "Creating Payment..."
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Create Crypto Payment
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 mb-2">
                ✓ Crypto payment created successfully!
              </p>
              <p className="text-xs text-green-700">
                Click below to complete your payment with cryptocurrency.
              </p>
            </div>

            <Button
              onClick={handlePayment}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Complete Crypto Payment
            </Button>
          </div>
        )}

        <Button
          onClick={onCancel}
          variant="outline"
          className="w-full"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payment Methods
        </Button>

        <div className="text-center text-xs text-gray-500">
          Secured by Coinbase Commerce
        </div>
      </CardContent>
    </Card>
  );
};

export default CoinbaseCheckout;