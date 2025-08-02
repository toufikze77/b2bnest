-- Create payments table to track all payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  company_name TEXT,
  contact_number TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  item_name TEXT NOT NULL,
  payment_method TEXT, -- card, bank_transfer, etc.
  stripe_customer_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payments" 
ON public.payments 
FOR SELECT 
USING (user_id = auth.uid() OR customer_email = auth.email());

-- Allow service role to insert/update (for webhooks)
CREATE POLICY "Service role can manage payments" 
ON public.payments 
FOR ALL 
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create notifications table for admin alerts
CREATE TABLE public.payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- email_sent, admin_notified, etc.
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage notifications
CREATE POLICY "Service role can manage notifications" 
ON public.payment_notifications 
FOR ALL 
USING (true);