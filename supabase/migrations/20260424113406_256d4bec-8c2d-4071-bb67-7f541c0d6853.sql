-- Fix 1: B2B form submissions PII exposure to anonymous users
DROP POLICY IF EXISTS "Users can view their own B2B submissions" ON public.b2b_form_submissions;

CREATE POLICY "Users can view their own B2B submissions"
ON public.b2b_form_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 2: Subscribers table privilege escalation - restrict UPDATE to own record
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

CREATE POLICY "update_own_subscription"
ON public.subscribers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR email = auth.email())
WITH CHECK (user_id = auth.uid() OR email = auth.email());

-- Also tighten the insert_subscription policy which has WITH CHECK true
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

CREATE POLICY "insert_subscription"
ON public.subscribers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR email = auth.email());