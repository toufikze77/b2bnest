-- Enable Row Level Security on advertisement_categories table
ALTER TABLE public.advertisement_categories ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view advertisement categories (they are public data)
CREATE POLICY "Anyone can view advertisement categories" 
ON public.advertisement_categories 
FOR SELECT 
USING (true);

-- Only allow system/admin to insert/update categories (for future management)
CREATE POLICY "System can manage advertisement categories" 
ON public.advertisement_categories 
FOR ALL 
USING (false) 
WITH CHECK (false);