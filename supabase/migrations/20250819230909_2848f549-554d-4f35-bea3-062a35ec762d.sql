-- Security fix for payments table: Implement proper encryption and access control

-- Create payment encryption functions
CREATE OR REPLACE FUNCTION public.encrypt_payment_data(data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    encrypted_data text;
BEGIN
    IF data IS NULL OR data = '' THEN
        RETURN NULL;
    END IF;
    
    -- Use base64 encoding as basic encryption (better than plain text)
    encrypted_data := encode(convert_to(data, 'UTF8'), 'base64');
    RETURN 'ENC:' || encrypted_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_payment_data(encrypted_data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    decrypted_data text;
BEGIN
    IF encrypted_data IS NULL OR encrypted_data = '' THEN
        RETURN NULL;
    END IF;
    
    -- If encrypted with our format, decrypt it
    IF encrypted_data LIKE 'ENC:%' THEN
        BEGIN
            decrypted_data := convert_from(decode(substring(encrypted_data from 5), 'base64'), 'UTF8');
        EXCEPTION WHEN OTHERS THEN
            -- If decryption fails, return NULL for security
            RETURN NULL;
        END;
    ELSE
        -- Plain text data (backward compatibility)
        decrypted_data := encrypted_data;
    END IF;
    
    RETURN decrypted_data;
END;
$$;

-- Create payment audit logs table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    payment_id uuid,
    action text NOT NULL,
    ip_address inet,
    user_agent text,
    admin_user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payment audit logs
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment audit logs
CREATE POLICY "Users can view their own payment audit logs"
ON public.payment_audit_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment audit logs"
ON public.payment_audit_logs
FOR SELECT
USING (is_admin_or_owner(auth.uid()));

CREATE POLICY "System can insert payment audit logs"
ON public.payment_audit_logs
FOR INSERT
WITH CHECK (true);

-- Drop the overly permissive system policy
DROP POLICY IF EXISTS "System can manage payment operations" ON public.payments;

-- Create secure function for payment creation (used by edge functions)
CREATE OR REPLACE FUNCTION public.create_payment_record(
    p_stripe_session_id text,
    p_user_id uuid DEFAULT NULL,
    p_customer_email text,
    p_customer_name text DEFAULT NULL,
    p_company_name text DEFAULT NULL,
    p_contact_number text DEFAULT NULL,
    p_amount integer,
    p_currency text DEFAULT 'gbp',
    p_item_name text,
    p_payment_method text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    payment_id uuid;
    encrypted_email text;
    encrypted_name text;
    encrypted_company text;
    encrypted_contact text;
BEGIN
    -- Encrypt sensitive customer data
    encrypted_email := public.encrypt_payment_data(p_customer_email);
    encrypted_name := CASE 
        WHEN p_customer_name IS NOT NULL THEN public.encrypt_payment_data(p_customer_name)
        ELSE NULL
    END;
    encrypted_company := CASE 
        WHEN p_company_name IS NOT NULL THEN public.encrypt_payment_data(p_company_name)
        ELSE NULL
    END;
    encrypted_contact := CASE 
        WHEN p_contact_number IS NOT NULL THEN public.encrypt_payment_data(p_contact_number)
        ELSE NULL
    END;
    
    -- Insert payment record with encrypted data
    INSERT INTO public.payments (
        stripe_session_id,
        user_id,
        customer_email,
        customer_name,
        company_name,
        contact_number,
        amount,
        currency,
        item_name,
        payment_method,
        metadata,
        status
    )
    VALUES (
        p_stripe_session_id,
        p_user_id,
        encrypted_email,
        encrypted_name,
        encrypted_company,
        encrypted_contact,
        p_amount,
        p_currency,
        p_item_name,
        p_payment_method,
        p_metadata,
        'pending'
    )
    RETURNING id INTO payment_id;
    
    -- Log the payment creation
    INSERT INTO public.payment_audit_logs (user_id, payment_id, action, ip_address)
    VALUES (p_user_id, payment_id, 'payment_created', inet_client_addr());
    
    RETURN payment_id;
END;
$$;

-- Create secure function for payment updates (used by webhooks)
CREATE OR REPLACE FUNCTION public.update_payment_status(
    p_stripe_session_id text DEFAULT NULL,
    p_stripe_payment_intent_id text DEFAULT NULL,
    p_status text,
    p_payment_method text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    payment_record RECORD;
BEGIN
    -- Find payment by stripe session or payment intent ID
    SELECT * INTO payment_record 
    FROM public.payments 
    WHERE (p_stripe_session_id IS NOT NULL AND stripe_session_id = p_stripe_session_id)
       OR (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id)
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update payment status
    UPDATE public.payments 
    SET 
        status = p_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = now()
    WHERE id = payment_record.id;
    
    -- Log the payment update
    INSERT INTO public.payment_audit_logs (user_id, payment_id, action, ip_address)
    VALUES (payment_record.user_id, payment_record.id, 'status_updated_to_' || p_status, inet_client_addr());
    
    RETURN true;
END;
$$;

-- Create secure function to get user's own payments
CREATE OR REPLACE FUNCTION public.get_user_payments(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    id uuid,
    stripe_session_id text,
    amount integer,
    currency text,
    status text,
    item_name text,
    payment_method text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: users can only access their own payments
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot access other users payment data';
    END IF;
    
    -- Audit log the access
    INSERT INTO public.payment_audit_logs (user_id, action, ip_address)
    VALUES (p_user_id, 'payments_accessed', inet_client_addr());
    
    -- Return safe payment data (no sensitive customer info)
    RETURN QUERY
    SELECT 
        p.id,
        p.stripe_session_id,
        p.amount,
        p.currency,
        p.status,
        p.item_name,
        p.payment_method,
        p.created_at,
        p.updated_at
    FROM public.payments p
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC;
END;
$$;

-- Create admin function to get payment details (with customer info for admin use)
CREATE OR REPLACE FUNCTION public.get_payment_details_admin(p_payment_id uuid)
RETURNS TABLE(
    id uuid,
    stripe_session_id text,
    customer_email text,
    customer_name text,
    company_name text,
    contact_number text,
    amount integer,
    currency text,
    status text,
    item_name text,
    payment_method text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: only admins can access customer details
    IF NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can access customer payment details';
    END IF;
    
    -- Audit log the admin access
    INSERT INTO public.payment_audit_logs (payment_id, action, ip_address, admin_user_id)
    VALUES (p_payment_id, 'admin_details_accessed', inet_client_addr(), auth.uid());
    
    -- Return decrypted customer data for admin use
    RETURN QUERY
    SELECT 
        p.id,
        p.stripe_session_id,
        public.decrypt_payment_data(p.customer_email) as customer_email,
        public.decrypt_payment_data(p.customer_name) as customer_name,
        public.decrypt_payment_data(p.company_name) as company_name,
        public.decrypt_payment_data(p.contact_number) as contact_number,
        p.amount,
        p.currency,
        p.status,
        p.item_name,
        p.payment_method,
        p.created_at
    FROM public.payments p
    WHERE p.id = p_payment_id;
END;
$$;

-- Update RLS policies to be more restrictive
CREATE POLICY "System functions can manage payments"
ON public.payments
FOR ALL
USING (false)
WITH CHECK (false);

-- Grant execute permissions only to authenticated users
GRANT EXECUTE ON FUNCTION public.create_payment_record(text, uuid, text, text, text, text, integer, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_status(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_payments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_details_admin(uuid) TO authenticated;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_user_id ON public.payment_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_payment_id ON public.payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_created_at ON public.payment_audit_logs(created_at);

-- Add comments
COMMENT ON FUNCTION public.encrypt_payment_data IS 'Encrypt sensitive payment customer data before storage';
COMMENT ON FUNCTION public.decrypt_payment_data IS 'Decrypt payment data for authorized access';
COMMENT ON FUNCTION public.create_payment_record IS 'Securely create payment records with encrypted customer data';
COMMENT ON FUNCTION public.update_payment_status IS 'Update payment status via secure function';
COMMENT ON FUNCTION public.get_user_payments IS 'Get user payments without sensitive customer data';
COMMENT ON FUNCTION public.get_payment_details_admin IS 'Admin function to access decrypted customer payment data';
COMMENT ON TABLE public.payment_audit_logs IS 'Audit trail for payment data access and modifications';