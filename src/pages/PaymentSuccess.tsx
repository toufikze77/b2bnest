import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentStatus, setPaymentStatus] = useState<'processing' | 'success'>('processing');
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const sessionId = searchParams.get('session_id');
  const createInvoice = searchParams.get('create_invoice');

  useEffect(() => {
    const processPayment = async () => {
      // Create invoice if this is a subscription payment
      if (sessionId && createInvoice === 'true') {
        try {
          const { data, error } = await supabase.functions.invoke('create-subscription-invoice', {
            body: { sessionId }
          });

          if (error) {
            console.error('Error creating invoice:', error);
            toast({
              title: "Invoice Creation Failed",
              description: "Payment successful but invoice creation failed. Please contact support.",
              variant: "destructive"
            });
          } else {
            setInvoiceCreated(true);
            toast({
              title: "Invoice Created",
              description: "Your payment invoice has been generated and is available in your dashboard.",
            });
          }
        } catch (error) {
          console.error('Error creating invoice:', error);
        }
      }

      // Wait a bit before showing success
      setTimeout(() => {
        setPaymentStatus('success');
      }, 2000);
    };

    processPayment();
  }, [sessionId, createInvoice]);

  const handleReturnHome = () => {
    navigate('/');
  };

  const handleReturnToPricing = () => {
    navigate('/pricing');
  };

  const handleViewDashboard = () => {
    navigate('/dashboard');
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
              {invoiceCreated && (
                <span className="block mt-2 text-primary font-medium">
                  Your invoice has been automatically generated and is available in your dashboard.
                </span>
              )}
            </p>
            {sessionId && (
              <p className="text-sm text-muted-foreground mt-2">
                Transaction ID: {sessionId}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            {invoiceCreated && (
              <Button onClick={handleViewDashboard} className="w-full" variant="default">
                <FileText className="h-4 w-4 mr-2" />
                View Invoice in Dashboard
              </Button>
            )}
            <Button onClick={handleReturnHome} className="w-full" variant={invoiceCreated ? "outline" : "default"}>
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