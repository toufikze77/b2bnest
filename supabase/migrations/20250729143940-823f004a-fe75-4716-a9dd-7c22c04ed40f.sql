-- Create table for storing RSS news articles
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  link TEXT NOT NULL UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE,
  source TEXT NOT NULL DEFAULT 'Reuters',
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read news articles
CREATE POLICY "News articles are viewable by everyone" 
ON public.news_articles 
FOR SELECT 
USING (true);

-- Create policy to allow only admins to insert/update news articles
CREATE POLICY "Only admins can manage news articles" 
ON public.news_articles 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_news_articles_updated_at
BEFORE UPDATE ON public.news_articles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_news_articles_published_at ON public.news_articles(published_at DESC);
CREATE INDEX idx_news_articles_source ON public.news_articles(source);
CREATE INDEX idx_news_articles_category ON public.news_articles(category);