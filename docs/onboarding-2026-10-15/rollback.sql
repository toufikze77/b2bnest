-- Rollback for docs/onboarding-2026-10-15/proposal.sql. Run export.sql FIRST and keep its output privately.
-- Effect: removes invitation email queue, notification settings, feedback and the new RPCs; restores the previous
-- invitation policy and ticket-queue claim. Members who already joined STAY members (remove them in Members & roles if wanted).
-- Accepted/revoked dates on invitations are lost. Queued status-change emails are deleted (kind no longer allowed).
-- Ticket emails cancelled by the package ('queued before email sending was approved') stay cancelled on purpose.
BEGIN;
DROP TRIGGER IF EXISTS support_tickets_status_notify ON public.support_tickets;
DROP TRIGGER IF EXISTS support_messages_notify_staff ON public.support_messages;
DROP FUNCTION IF EXISTS public.support_message_notify_staff(), public._support_notify_staff(uuid,uuid,text,text);
GRANT INSERT ON public.organization_members TO anon, authenticated; -- as live before the package
DROP TRIGGER IF EXISTS support_customers_queue_invitation ON public.support_customers;
DROP FUNCTION IF EXISTS public.support_ticket_status_notify(), public.support_queue_customer_invitation(),
  public.support_submit_feedback(uuid,integer,text), public.support_feedback_submitted(uuid),
  public.onboarding_outbox_claim(integer), public.onboarding_outbox_finish(uuid,text,text), public.onboarding_email_status(uuid),
  public.org_invite_member(uuid,text,text), public.org_invitation_token(uuid), public.org_manage_invitation(uuid,text),
  public.org_invitation_preview(text), public.org_accept_invitation(text), public.org_seat_summary(uuid),
  public._seat_pool_lock(uuid), public._seat_already_counted(uuid,text), public._seat_pool(uuid), public._seat_pool_orgs(uuid), public._org_billing_owner(uuid);
DROP TABLE IF EXISTS public.support_ticket_feedback, public.support_notification_prefs, public.onboarding_email_outbox;
ALTER TABLE public.support_settings DROP COLUMN IF EXISTS feedback_enabled;
DELETE FROM public.support_email_outbox WHERE kind = 'status_change';
ALTER TABLE public.support_email_outbox DROP CONSTRAINT support_email_outbox_kind_check;
ALTER TABLE public.support_email_outbox ADD CONSTRAINT support_email_outbox_kind_check CHECK (kind IN ('acknowledgement','public_reply'));
DROP FUNCTION public.support_outbox_claim(integer);
CREATE FUNCTION public.support_outbox_claim(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, recipient_user_id uuid, attempts integer, support_name text, reference text, subject text, reply_body text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.support_email_outbox o SET status='uncertain', last_error='sender stopped mid-send; provider outcome unknown', updated_at=now()
   WHERE o.status='sending' AND o.locked_until < now();
  RETURN QUERY
  WITH due AS (
    SELECT o.id FROM public.support_email_outbox o
     WHERE o.status IN ('pending','failed') AND o.attempts < 5 AND o.next_attempt_at <= now()
     ORDER BY o.created_at LIMIT least(greatest(_limit,1),50) FOR UPDATE SKIP LOCKED),
  upd AS (
    UPDATE public.support_email_outbox o SET status='sending', attempts=o.attempts+1, locked_until=now()+interval '5 minutes', updated_at=now()
     FROM due WHERE o.id=due.id RETURNING o.*)
  SELECT u.id, u.kind, u.recipient_user_id, u.attempts, s.support_name, t.reference, t.subject,
         CASE WHEN m.is_internal THEN NULL ELSE m.body END
    FROM upd u JOIN public.support_tickets t ON t.id=u.ticket_id
    JOIN public.support_settings s ON s.organization_id=u.organization_id
    LEFT JOIN public.support_messages m ON m.id=u.message_id;
END $$;
REVOKE ALL ON FUNCTION public.support_outbox_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_outbox_claim(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(id uuid, organization_id uuid, email text, role text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, organization_id, email, role, expires_at, accepted_at FROM public.organization_invitations
   WHERE p_token IS NOT NULL AND token = p_token AND (expires_at IS NULL OR expires_at > now()) AND accepted_at IS NULL LIMIT 1;
$$;
DROP POLICY IF EXISTS "Company owners and admins can view invitations" ON public.organization_invitations;
DROP INDEX IF EXISTS public.organization_invitations_one_live;
ALTER TABLE public.organization_invitations DROP COLUMN IF EXISTS revoked_at, DROP COLUMN IF EXISTS accepted_by;
-- Live before the package (read 2026-10-15): no table or column grants to anon/authenticated on this table.
REVOKE ALL ON public.organization_invitations FROM anon, authenticated;
CREATE POLICY "Organization admins can manage invitations" ON public.organization_invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_members.organization_id = organization_invitations.organization_id
    AND organization_members.user_id = auth.uid() AND organization_members.role = ANY (ARRAY['owner','admin']) AND organization_members.is_active = true));
COMMIT;
