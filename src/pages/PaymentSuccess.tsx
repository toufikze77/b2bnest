import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentStatus, setPaymentStatus] = useState<'processing' | 'success'>('processing');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Simulate payment processing verification
    const timer = setTimeout(() => {
      setPaymentStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleReturnHome = () => {
    navigate('/');
  };

  const handleReturnToPricing = () => {
    navigate('/pricing');
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
              Please wait while we process your Stripe payment...
            </p>
            {sessionId && (
              <p className="text-sm text-muted-foreground mt-2">
                Session ID: {sessionId}
              </p>
            )}
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
            <CheckCircle className="h-5 w-5 text-green-500" />
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <p className="text-muted-foreground">
              Your payment has been processed successfully. You should receive a confirmation email shortly.
            </p>
            {sessionId && (
              <p className="text-sm text-muted-foreground mt-2">
                Transaction ID: {sessionId}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleReturnHome} className="w-full">
              Return to Home
            </Button>
            <Button onClick={handleReturnToPricing} variant="outline" className="w-full">
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;