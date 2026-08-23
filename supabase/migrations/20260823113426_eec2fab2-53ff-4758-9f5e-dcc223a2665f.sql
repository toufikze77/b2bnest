DROP POLICY IF EXISTS "Users can create payments for themselves" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;

CREATE POLICY "Users can insert their own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (customer_email IS NULL OR customer_email = auth.email())
);

DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

CREATE POLICY "insert_subscription"
ON public.subscribers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (email IS NULL OR email = auth.email())
);