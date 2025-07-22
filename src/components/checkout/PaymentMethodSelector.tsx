
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Wallet } from 'lucide-react';
import StripeCheckout from './StripeCheckout';
import SolanaPayCheckout from './SolanaPayCheckout';

interface PaymentMethodSelectorProps {
  amount: number;
  currency: string;
  itemName: string;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentError: (error: string) => void;
}

type PaymentMethod = 'stripe' | 'solana' | null;

const PaymentMethodSelector = ({
  amount,
  currency,
  itemName,
  onPaymentSuccess,
  onPaymentError
}: PaymentMethodSelectorProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);

  const resetSelection = () => setSelectedMethod(null);

  if (selectedMethod === 'stripe') {
    return (
      <StripeCheckout
        amount={amount}
        currency={currency}
        itemName={itemName}
        onSuccess={onPaymentSuccess}
        onError={onPaymentError}
        onCancel={resetSelection}
      />
    );
  }

  if (selectedMethod === 'solana') {
    return (
      <SolanaPayCheckout
        amount={amount}
        itemName={itemName}
        onSuccess={onPaymentSuccess}
        onError={onPaymentError}
        onCancel={resetSelection}
      />
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Choose Payment Method
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
            onClick={() => setSelectedMethod('stripe')}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Pay with Stripe
            <Badge variant="secondary" className="ml-2 text-xs">
              Cards & Bank Transfer
            </Badge>
          </Button>

          <Button
            onClick={() => setSelectedMethod('solana')}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            <Wallet className="h-5 w-5 mr-2" />
            Pay with Solana
            <Badge variant="secondary" className="ml-2 text-xs">
              Fast & Low Fees
            </Badge>
          </Button>
        </div>

        <div className="text-center text-xs text-gray-500 mt-4">
          Secure payments powered by Stripe and Solana blockchain
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodSelector;
