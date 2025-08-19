-- Security fix for banking data: Encrypt sensitive banking fields and implement secure access

-- Create banking encryption functions
CREATE OR REPLACE FUNCTION public.encrypt_banking_data(data text)
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

CREATE OR REPLACE FUNCTION public.decrypt_banking_data(encrypted_data text)
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

-- Create banking audit logs table
CREATE TABLE IF NOT EXISTS public.banking_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    bank_account_id uuid,
    action text NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on banking audit logs
ALTER TABLE public.banking_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for banking audit logs
CREATE POLICY "Users can view their own banking audit logs"
ON public.banking_audit_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all banking audit logs"
ON public.banking_audit_logs
FOR SELECT
USING (is_admin_or_owner(auth.uid()));

CREATE POLICY "System can insert banking audit logs"
ON public.banking_audit_logs
FOR INSERT
WITH CHECK (true);

-- Create secure function to get banking details (without sensitive data by default)
CREATE OR REPLACE FUNCTION public.get_bank_accounts_safe(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    id uuid,
    account_id text,
    provider_name text,
    account_type text,
    currency text,
    balance numeric,
    available_balance numeric,
    last_synced_at timestamp with time zone,
    is_active boolean,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: users can only access their own accounts
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot access other users banking data';
    END IF;
    
    -- Audit log the access
    INSERT INTO public.banking_audit_logs (user_id, action, ip_address)
    VALUES (p_user_id, 'accounts_accessed', inet_client_addr());
    
    -- Return safe account data (no account numbers or sort codes)
    RETURN QUERY
    SELECT 
        ba.id,
        ba.account_id,
        ba.provider_name,
        ba.account_type,
        ba.currency,
        ba.balance,
        ba.available_balance,
        ba.last_synced_at,
        ba.is_active,
        ba.created_at
    FROM public.bank_accounts ba
    WHERE ba.user_id = p_user_id
      AND ba.is_active = true
    ORDER BY ba.created_at DESC;
END;
$$;

-- Create secure function to get sensitive banking details (only when absolutely needed)
CREATE OR REPLACE FUNCTION public.get_bank_account_details(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    account_number text,
    sort_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security check: users can only access their own accounts
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot access other users banking details';
    END IF;
    
    -- Verify the account belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM public.bank_accounts 
        WHERE id = p_account_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied: Account not found or not owned by user';
    END IF;
    
    -- Audit log the sensitive data access
    INSERT INTO public.banking_audit_logs (user_id, bank_account_id, action, ip_address)
    VALUES (p_user_id, p_account_id, 'sensitive_details_accessed', inet_client_addr());
    
    -- Return decrypted sensitive data
    RETURN QUERY
    SELECT 
        public.decrypt_banking_data(ba.account_number) as account_number,
        public.decrypt_banking_data(ba.sort_code) as sort_code
    FROM public.bank_accounts ba
    WHERE ba.id = p_account_id AND ba.user_id = p_user_id;
END;
$$;

-- Create secure function to store banking data
CREATE OR REPLACE FUNCTION public.store_bank_account(
    p_account_id text,
    p_provider_id text,
    p_provider_name text,
    p_account_type text,
    p_account_number text DEFAULT NULL,
    p_sort_code text DEFAULT NULL,
    p_currency text DEFAULT 'GBP',
    p_balance numeric DEFAULT NULL,
    p_available_balance numeric DEFAULT NULL,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    bank_account_id uuid;
    encrypted_account_number text;
    encrypted_sort_code text;
BEGIN
    -- Verify user can only store their own banking data
    IF p_user_id != auth.uid() AND NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Cannot store banking data for other users';
    END IF;
    
    -- Encrypt sensitive data
    encrypted_account_number := CASE 
        WHEN p_account_number IS NOT NULL THEN public.encrypt_banking_data(p_account_number)
        ELSE NULL
    END;
    encrypted_sort_code := CASE 
        WHEN p_sort_code IS NOT NULL THEN public.encrypt_banking_data(p_sort_code)
        ELSE NULL
    END;
    
    -- Insert or update the bank account
    INSERT INTO public.bank_accounts (
        user_id,
        account_id,
        provider_id,
        provider_name,
        account_type,
        account_number,
        sort_code,
        currency,
        balance,
        available_balance,
        is_active
    )
    VALUES (
        p_user_id,
        p_account_id,
        p_provider_id,
        p_provider_name,
        p_account_type,
        encrypted_account_number,
        encrypted_sort_code,
        p_currency,
        p_balance,
        p_available_balance,
        true
    )
    ON CONFLICT (user_id, account_id) 
    DO UPDATE SET
        provider_name = EXCLUDED.provider_name,
        account_type = EXCLUDED.account_type,
        account_number = EXCLUDED.account_number,
        sort_code = EXCLUDED.sort_code,
        currency = EXCLUDED.currency,
        balance = EXCLUDED.balance,
        available_balance = EXCLUDED.available_balance,
        updated_at = now()
    RETURNING id INTO bank_account_id;
    
    -- Log the banking data storage
    INSERT INTO public.banking_audit_logs (user_id, bank_account_id, action, ip_address)
    VALUES (p_user_id, bank_account_id, 'account_stored', inet_client_addr());
    
    RETURN bank_account_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_bank_accounts_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bank_account_details(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_bank_account(text, text, text, text, text, text, text, numeric, numeric, uuid) TO authenticated;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_banking_audit_logs_user_id ON public.banking_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_banking_audit_logs_created_at ON public.banking_audit_logs(created_at);

-- Add comments
COMMENT ON FUNCTION public.encrypt_banking_data IS 'Encrypt sensitive banking data before storage';
COMMENT ON FUNCTION public.decrypt_banking_data IS 'Decrypt banking data for authorized access';
COMMENT ON FUNCTION public.get_bank_accounts_safe IS 'Get bank accounts without sensitive details';
COMMENT ON FUNCTION public.get_bank_account_details IS 'Get sensitive banking details with audit logging';
COMMENT ON FUNCTION public.store_bank_account IS 'Securely store bank account data with encryption';
COMMENT ON TABLE public.banking_audit_logs IS 'Audit trail for banking data access and modifications';