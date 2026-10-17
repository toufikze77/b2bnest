-- Phase 4b document email log — PROPOSAL, NOT APPLIED. Apply only after the owner approves (see README.md).
-- One transaction: any failure leaves nothing behind.
-- Adds one table, public.document_email_log, written only by the send-document-email Edge Function (service role).
-- It stores no email addresses, subjects or bodies: ids, kind, the recipient's domain, the outcome, the failing SMTP stage
-- and the mail server's reply with addresses redacted (max 300 characters).
-- Owners can read their own rows. Nobody else can read them, and no signed-in user can add, change or delete rows.
-- Also adds document_email_recent_counts(), used by the Edge Function for the 20-per-user / 3-per-document daily limits.
BEGIN;

CREATE TABLE public.document_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_kind text NOT NULL CHECK (document_kind IN ('invoice', 'quote')),
  document_id uuid NOT NULL,
  recipient_domain text CHECK (recipient_domain IS NULL OR (length(recipient_domain) <= 253 AND position('@' IN recipient_domain) = 0)),
  status text NOT NULL CHECK (status IN ('accepted_by_provider', 'failed', 'uncertain')),
  error_stage text CHECK (error_stage IS NULL OR length(error_stage) <= 40),
  provider_reply text CHECK (provider_reply IS NULL OR length(provider_reply) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.document_email_log IS
  'One row per attempt to email an invoice or quote (send-document-email). accepted_by_provider = the mail server accepted it; it does not mean delivered. No addresses or message text are stored.';

CREATE INDEX document_email_log_user_created ON public.document_email_log (user_id, created_at);
CREATE INDEX document_email_log_document_created ON public.document_email_log (document_id, created_at);

ALTER TABLE public.document_email_log ENABLE ROW LEVEL SECURITY;
-- Supabase grants new public tables to anon/authenticated by default; take that back and allow reading only.
REVOKE ALL ON public.document_email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_email_log TO authenticated;
GRANT ALL ON public.document_email_log TO service_role;
CREATE POLICY "Owners can read their own document email log" ON public.document_email_log
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
-- Deliberately no INSERT / UPDATE / DELETE policy: only the Edge Function (service role, bypasses RLS) writes.

-- Emails that went out (accepted) or may have gone out (uncertain) since _since, for the user and for one document.
-- Failed attempts sent nothing, so they don't count towards the limits.
CREATE FUNCTION public.document_email_recent_counts(_user_id uuid, _document_id uuid, _since timestamptz)
RETURNS TABLE (user_count integer, document_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::integer,
         (count(*) FILTER (WHERE l.document_id = _document_id))::integer
  FROM public.document_email_log l
  WHERE l.user_id = _user_id AND l.created_at >= _since AND l.status IN ('accepted_by_provider', 'uncertain');
$$;
REVOKE ALL ON FUNCTION public.document_email_recent_counts(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_email_recent_counts(uuid, uuid, timestamptz) TO service_role;

COMMIT;
