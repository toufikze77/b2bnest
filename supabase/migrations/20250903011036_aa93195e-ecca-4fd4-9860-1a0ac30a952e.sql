-- Fix todo_comments RLS policies to allow users to delete their own comments
-- Currently users can't delete comments due to missing DELETE policy

-- Add policy to allow users to delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.todo_comments 
FOR DELETE 
USING (auth.uid() = user_id);