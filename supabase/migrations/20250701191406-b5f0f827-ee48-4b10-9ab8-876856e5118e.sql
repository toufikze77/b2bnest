
-- Create table for user purchases/downloads
CREATE TABLE public.user_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  document_id UUID REFERENCES public.documents(id) NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, document_id)
);

-- Create table for user favorites
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  document_id UUID REFERENCES public.documents(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id)
);

-- Add RLS policies for user_documents
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases" 
  ON public.user_documents 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases" 
  ON public.user_documents 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchases" 
  ON public.user_documents 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add RLS policies for user_favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites" 
  ON public.user_favorites 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" 
  ON public.user_favorites 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Add preview_url column to documents table if it doesn't exist
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Add thumbnail_url column to documents table if it doesn't exist
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
