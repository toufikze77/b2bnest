-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;

-- Create the table if it doesn't exist (it already exists based on the error)
-- CREATE TABLE IF NOT EXISTS public.ai_conversations (... table already exists)

-- Recreate the policies with correct names
CREATE POLICY "ai_conversations_select_policy"
  ON public.ai_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ai_conversations_insert_policy"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);