-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);

-- Create policies for logo uploads
CREATE POLICY "Users can view company logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their own company logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own company logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own company logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add logo_url column to quotes table
ALTER TABLE public.quotes ADD COLUMN logo_url TEXT;

-- Add logo_url column to invoices table  
ALTER TABLE public.invoices ADD COLUMN logo_url TEXT;