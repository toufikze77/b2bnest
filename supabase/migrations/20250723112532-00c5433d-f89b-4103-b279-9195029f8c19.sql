-- Add foreign key constraint to feedback_requests table
ALTER TABLE public.feedback_requests 
ADD CONSTRAINT feedback_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;