import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const SumUpPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentStatus, setPaymentStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const checkoutId = searchParams.get('checkout_id');

  useEffect(() => {
    if (!checkoutId) {
      navigate('/');
      return;
    }

    // Simulate payment processing
    const timer = setTimeout(() => {
      // For now, we'll simulate a successful payment
      // In a real implementation, you'd verify the payment status with SumUp
      setPaymentStatus('success');
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkoutId, navigate]);

  const handleReturnHome = () => {
    navigate('/');
  };

  if (paymentStatus === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Please wait while we process your SumUp payment...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Checkout ID: {checkoutId}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {paymentStatus === 'success' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Payment Successful!
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Payment Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {paymentStatus === 'success' ? (
            <div>
              <p className="text-muted-foreground">
                Your payment has been processed successfully. You should receive a confirmation email shortly.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Transaction ID: {checkoutId}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              There was an issue processing your payment. Please try again or contact support.
            </p>
          )}
          
          <Button onClick={handleReturnHome} className="w-full">
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SumUpPayment;