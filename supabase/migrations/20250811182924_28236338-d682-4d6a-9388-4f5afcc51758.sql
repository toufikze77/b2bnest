-- Fix critical security vulnerability in payments table RLS policies
-- Drop the overly permissive policy and create proper restrictive policies

-- First, drop the existing overly broad policy
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;

-- Create specific policies for different operations

-- Allow service role to insert/update payments (needed for webhooks and payment creation)
CREATE POLICY "System can manage payment operations"
ON public.payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view only their own payments (either by user_id or email)
CREATE POLICY "Users can view their own payments only"
ON public.payments
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (auth.email() = customer_email)
);

-- Prevent all public access (anonymous users cannot access payments at all)
CREATE POLICY "Block anonymous access to payments"
ON public.payments
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Allow authenticated users to insert payments only for themselves
CREATE POLICY "Users can create payments for themselves"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id) OR 
  (auth.email() = customer_email)
);

-- Users cannot update or delete payments (only system can do this via service role)
-- This ensures payment integrity