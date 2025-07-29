-- Create user_favorite_tools table to store user tool preferences
CREATE TABLE public.user_favorite_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_favorite_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for users to manage their own favorites
CREATE POLICY "Users can view their own favorites" 
ON public.user_favorite_tools 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites" 
ON public.user_favorite_tools 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" 
ON public.user_favorite_tools 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_favorite_tools_user_id ON public.user_favorite_tools(user_id);
CREATE INDEX idx_user_favorite_tools_tool_id ON public.user_favorite_tools(tool_id);