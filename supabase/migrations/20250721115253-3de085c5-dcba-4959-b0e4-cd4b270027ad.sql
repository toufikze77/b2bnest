-- Create AI workspaces table for premium users
CREATE TABLE public.ai_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_workspaces ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own workspaces" 
ON public.ai_workspaces 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workspaces" 
ON public.ai_workspaces 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspaces" 
ON public.ai_workspaces 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspaces" 
ON public.ai_workspaces 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_ai_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_workspaces_updated_at
  BEFORE UPDATE ON public.ai_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_workspaces_updated_at();