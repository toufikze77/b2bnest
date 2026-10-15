-- Undo for proposal.sql. RUN export.sql FIRST and keep its JSON: this deletes every ticket, reply, note and
-- attachment record. Files in the "support-attachments" bucket must be removed separately (Storage tool).
-- Touches no existing table.
BEGIN;
DROP POLICY IF EXISTS "Support files: read if attachment visible" ON storage.objects;
DROP POLICY IF EXISTS "Support files: upload into a visible ticket folder" ON storage.objects;
DROP TABLE IF EXISTS public.support_email_outbox, public.support_attachments, public.support_messages, public.support_tickets,
  public.support_customers, public.support_agents, public.support_categories, public.support_settings CASCADE;
DROP FUNCTION IF EXISTS public.support_claim_invitations(), public.support_create_ticket(uuid,text,text,uuid,text,uuid),
  public.support_add_message(uuid,text,boolean,uuid), public.support_update_ticket(uuid,text,text,uuid,uuid,boolean),
  public.support_add_attachment(uuid,uuid,text,text,integer,text,boolean), public.support_notify(uuid,text,text),
  public.support_settings_guard(), public.support_customers_guard(),
  public.support_can_view_ticket(uuid), public.support_is_customer(uuid), public.support_is_agent(uuid), public.support_is_manager(uuid);
-- In-app notifications already delivered (type='support') are kept on purpose.
COMMIT;
