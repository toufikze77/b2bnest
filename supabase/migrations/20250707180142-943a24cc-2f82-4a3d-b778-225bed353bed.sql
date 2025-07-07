-- Create audit logs table for tracking user actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for audit logs
CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create function to log user actions
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create CRM contacts table with audit trail
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'prospect', 'customer')),
  value NUMERIC DEFAULT 0,
  last_contact TIMESTAMP WITH TIME ZONE,
  source TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on CRM contacts
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM contacts
CREATE POLICY "Users can manage their own contacts" 
ON public.crm_contacts 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all contacts" 
ON public.crm_contacts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Create CRM deals table
CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on CRM deals
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM deals
CREATE POLICY "Users can manage their own deals" 
ON public.crm_deals 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deals" 
ON public.crm_deals 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_crm_contacts_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_crm_deals_updated_at
BEFORE UPDATE ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create integration settings table
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, integration_name)
);

-- Enable RLS on integration settings
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for integration settings
CREATE POLICY "Users can manage their own integration settings" 
ON public.integration_settings 
FOR ALL 
USING (auth.uid() = user_id);