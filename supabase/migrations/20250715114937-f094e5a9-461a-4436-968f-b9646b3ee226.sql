-- Create advertisements table for premium subscribers
CREATE TABLE public.advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  image_urls TEXT[] DEFAULT '{}',
  is_service BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  featured_until TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_advertisement UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active advertisements
CREATE POLICY "Anyone can view active advertisements" 
ON public.advertisements 
FOR SELECT 
USING (is_active = true);

-- Users can view their own advertisements (active or inactive)
CREATE POLICY "Users can view their own advertisements" 
ON public.advertisements 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own advertisements (will check subscription in app logic)
CREATE POLICY "Users can create their own advertisements" 
ON public.advertisements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own advertisements
CREATE POLICY "Users can update their own advertisements" 
ON public.advertisements 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own advertisements
CREATE POLICY "Users can delete their own advertisements" 
ON public.advertisements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create advertisement categories table
CREATE TABLE public.advertisement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO public.advertisement_categories (name, description, icon) VALUES
  ('Technology', 'Software, IT services, and tech solutions', 'monitor'),
  ('Marketing', 'Digital marketing, advertising, and promotion services', 'megaphone'),
  ('Consulting', 'Business consulting and advisory services', 'briefcase'),
  ('Design', 'Graphic design, web design, and creative services', 'palette'),
  ('Finance', 'Accounting, bookkeeping, and financial services', 'calculator'),
  ('Legal', 'Legal services and consultation', 'scale'),
  ('Health', 'Health and wellness services', 'heart'),
  ('Education', 'Training, courses, and educational services', 'graduation-cap'),
  ('Real Estate', 'Property and real estate services', 'home'),
  ('Other', 'Other professional services', 'briefcase');

-- Create storage bucket for advertisement images
INSERT INTO storage.buckets (id, name, public) VALUES ('advertisement-images', 'advertisement-images', true);

-- Create storage policies for advertisement images
CREATE POLICY "Anyone can view advertisement images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'advertisement-images');

CREATE POLICY "Authenticated users can upload advertisement images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'advertisement-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own advertisement images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'advertisement-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own advertisement images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'advertisement-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();