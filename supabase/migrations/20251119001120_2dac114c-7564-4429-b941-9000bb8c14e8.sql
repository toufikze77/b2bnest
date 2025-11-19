-- Create update function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_b2b_forms_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create B2B Form submissions table
CREATE TABLE IF NOT EXISTS public.b2b_form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  company_size TEXT,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  ai_analysis JSONB,
  ai_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID
);

-- Enable RLS
ALTER TABLE public.b2b_form_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit B2B forms"
ON public.b2b_form_submissions
FOR INSERT
WITH CHECK (true);

-- Allow authenticated users to view their own submissions
CREATE POLICY "Users can view their own B2B submissions"
ON public.b2b_form_submissions
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all submissions
CREATE POLICY "Admins can view all B2B submissions"
ON public.b2b_form_submissions
FOR SELECT
USING (is_admin_or_owner(auth.uid()));

-- Create index for performance
CREATE INDEX idx_b2b_submissions_email ON public.b2b_form_submissions(email);
CREATE INDEX idx_b2b_submissions_created_at ON public.b2b_form_submissions(created_at DESC);
CREATE INDEX idx_b2b_submissions_status ON public.b2b_form_submissions(status);

-- Create trigger for updated_at
CREATE TRIGGER update_b2b_submissions_updated_at
BEFORE UPDATE ON public.b2b_form_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_b2b_forms_updated_at();