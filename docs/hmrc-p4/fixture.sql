-- HMRC P4 local fixture: invoices, expenses and bills exactly as in production (columns, RLS policies and triggers read
-- on 7 Nov 2026), so proposal.sql's shape checks and the VAT rules can be tested. Loaded before the demo read-only
-- fixture (which then skips these three tables) and its proposal (which adds a0_demo_readonly_guard).
-- invoices_notify_paid is a local stand-in with production's name (its body needs the notifications schema).
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_bills_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_invoice_paid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN RETURN NEW; END;
$function$;

CREATE TABLE public.invoices (id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL, invoice_number text NOT NULL UNIQUE, company_name text,
  company_address text, client_name text, client_email text, client_address text, items jsonb DEFAULT '[]'::jsonb, subtotal numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0, tax_amount numeric(10,2) DEFAULT 0, total_amount numeric(10,2) DEFAULT 0, due_date date, notes text,
  status text DEFAULT 'pending'::text, logo_url text, created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL, currency text DEFAULT 'USD'::text, paid_at timestamp with time zone,
  archived_at timestamp with time zone);
CREATE TABLE public.expenses (id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL, supplier_id uuid, category text NOT NULL,
  description text NOT NULL, amount numeric(10,2) NOT NULL, date date NOT NULL, receipt_url text, status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.bills (id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_number text, vendor_name text NOT NULL, vendor_email text, vendor_address text, description text NOT NULL, amount numeric NOT NULL,
  currency text DEFAULT 'GBP'::text NOT NULL, issue_date date NOT NULL, due_date date NOT NULL, status text DEFAULT 'pending'::text NOT NULL
  CONSTRAINT bills_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])),
  category text DEFAULT 'general'::text NOT NULL, payment_method text, payment_reference text, paid_date date, notes text, attachment_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bills" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bills" ON public.bills FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own bills" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['invoices', 'expenses', 'bills'] LOOP
    EXECUTE format('CREATE POLICY require_aal2_if_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
  END LOOP;
END $$;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER invoices_notify_paid AFTER UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_paid();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_bills_updated_at();
COMMIT;
