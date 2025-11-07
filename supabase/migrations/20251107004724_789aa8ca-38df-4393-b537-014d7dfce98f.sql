-- Create HMRC integrations table for storing OAuth tokens
CREATE TABLE public.hmrc_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  is_connected BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Create HMRC settings table for storing configuration
CREATE TABLE public.hmrc_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT,
  company_number TEXT,
  utr TEXT,
  vat_number TEXT,
  paye_reference TEXT,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  auto_submit_vat BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  reminder_days INTEGER DEFAULT 7,
  sandbox_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Create HMRC submission logs table for audit trail
CREATE TABLE public.hmrc_submission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL, -- 'FPS', 'EPS', 'VAT', 'CT', 'SA'
  submission_id TEXT,
  period TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'submitted', 'accepted', 'rejected', 'error'
  request_payload JSONB,
  response_data JSONB,
  error_message TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hmrc_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hmrc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hmrc_submission_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hmrc_integrations
CREATE POLICY "Users can view their own HMRC integrations"
  ON public.hmrc_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HMRC integrations"
  ON public.hmrc_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own HMRC integrations"
  ON public.hmrc_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own HMRC integrations"
  ON public.hmrc_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for hmrc_settings
CREATE POLICY "Users can view their own HMRC settings"
  ON public.hmrc_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HMRC settings"
  ON public.hmrc_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own HMRC settings"
  ON public.hmrc_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own HMRC settings"
  ON public.hmrc_settings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for hmrc_submission_logs
CREATE POLICY "Users can view their own HMRC submission logs"
  ON public.hmrc_submission_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HMRC submission logs"
  ON public.hmrc_submission_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all submission logs
CREATE POLICY "Admins can view all HMRC submission logs"
  ON public.hmrc_submission_logs FOR SELECT
  USING (is_admin_or_owner(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_hmrc_integrations_user_id ON public.hmrc_integrations(user_id);
CREATE INDEX idx_hmrc_integrations_org_id ON public.hmrc_integrations(organization_id);
CREATE INDEX idx_hmrc_settings_user_id ON public.hmrc_settings(user_id);
CREATE INDEX idx_hmrc_settings_org_id ON public.hmrc_settings(organization_id);
CREATE INDEX idx_hmrc_submission_logs_user_id ON public.hmrc_submission_logs(user_id);
CREATE INDEX idx_hmrc_submission_logs_org_id ON public.hmrc_submission_logs(organization_id);
CREATE INDEX idx_hmrc_submission_logs_type ON public.hmrc_submission_logs(submission_type);
CREATE INDEX idx_hmrc_submission_logs_status ON public.hmrc_submission_logs(status);

-- Create update timestamp trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_hmrc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add update triggers
CREATE TRIGGER update_hmrc_integrations_updated_at
  BEFORE UPDATE ON public.hmrc_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hmrc_updated_at();

CREATE TRIGGER update_hmrc_settings_updated_at
  BEFORE UPDATE ON public.hmrc_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hmrc_updated_at();

CREATE TRIGGER update_hmrc_submission_logs_updated_at
  BEFORE UPDATE ON public.hmrc_submission_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hmrc_updated_at();

-- Create encryption functions for sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_hmrc_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
  IF token IS NULL OR token = '' THEN
    RETURN NULL;
  END IF;
  RETURN 'ENC:' || encode(convert_to(token, 'UTF8'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.decrypt_hmrc_token(encrypted_token TEXT)
RETURNS TEXT AS $$
DECLARE
  decrypted_token TEXT;
BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  IF encrypted_token LIKE 'ENC:%' THEN
    BEGIN
      decrypted_token := convert_from(decode(substring(encrypted_token from 5), 'base64'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    decrypted_token := encrypted_token;
  END IF;
  
  RETURN decrypted_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';