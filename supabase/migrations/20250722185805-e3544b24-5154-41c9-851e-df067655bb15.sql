-- Create feedback_requests table for user feedback and feature requests
CREATE TABLE public.feedback_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feedback', 'feature_request')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for feedback_requests
CREATE POLICY "Users can create their own feedback/requests" 
ON public.feedback_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback/requests" 
ON public.feedback_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback/requests" 
ON public.feedback_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update feedback/requests" 
ON public.feedback_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_feedback_requests_updated_at
BEFORE UPDATE ON public.feedback_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();