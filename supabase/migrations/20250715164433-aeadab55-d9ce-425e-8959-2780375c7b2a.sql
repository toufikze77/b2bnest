-- Add currency column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN currency TEXT DEFAULT 'USD';

-- Add currency column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN currency TEXT DEFAULT 'USD';