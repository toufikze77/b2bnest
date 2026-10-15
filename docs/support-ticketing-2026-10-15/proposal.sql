-- B2BNEST Support ticketing (multi-tenant) — release package, NOT APPLIED.
-- Additive only: creates new support_* tables, helpers, RPCs and storage.objects policies.
-- Touches no existing table, policy, billing or seat logic. Runs as ONE transaction.
-- Prerequisite (separate tool step at approval time): private bucket "support-attachments", 10 MB limit.
BEGIN;

-- ---------- Tables ----------
CREATE TABLE public.support_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  support_name text NOT NULL CHECK (length(btrim(support_name)) BETWEEN 1 AND 80),
  logo_url text CHECK (logo_url IS NULL OR logo_url ~ '^https://'),
  support_hours text CHECK (support_hours IS NULL OR length(support_hours) <= 300), -- unset = hours message hidden
  time_zone text CHECK (time_zone IS NULL OR length(time_zone) <= 60),
  portal_enabled boolean NOT NULL DEFAULT false,
  next_ticket_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.support_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
-- Staff with explicit support permission (must also be active company members = existing paid seats).
CREATE TABLE public.support_agents (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
-- External customers: NOT company members, so they get no projects/CRM/finance and use no staff seat.
CREATE TABLE public.support_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
  display_name text CHECK (display_name IS NULL OR length(display_name) <= 100),
  client_name text CHECK (client_name IS NULL OR length(client_name) <= 120),
  user_id uuid, invited_by uuid NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 10000),
  category_id uuid REFERENCES public.support_categories(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','waiting_customer','resolved','closed')),
  requester_id uuid NOT NULL, assignee_id uuid,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz, closed_at timestamptz,
  UNIQUE (organization_id, reference), UNIQUE (requester_id, client_request_id)
);
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  is_internal boolean NOT NULL DEFAULT false,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, client_request_id)
);
CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/gif','image/webp','application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  is_internal boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- Email queue: written by RPCs, read/sent ONLY by server code (service_role). Dedupe key = one email per event+recipient.
CREATE TABLE public.support_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('acknowledgement','public_reply')),
  recipient_user_id uuid NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted_by_provider','failed')),
  attempts integer NOT NULL DEFAULT 0, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.support_tickets (organization_id, status, updated_at DESC);
CREATE INDEX ON public.support_tickets (requester_id);
CREATE INDEX ON public.support_messages (ticket_id, created_at);
CREATE INDEX ON public.support_customers (user_id);

-- ---------- Grants (explicit; anon gets nothing) ----------
REVOKE ALL ON public.support_settings, public.support_categories, public.support_agents, public.support_customers,
  public.support_tickets, public.support_messages, public.support_attachments, public.support_email_outbox FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.support_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_categories TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.support_agents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_customers TO authenticated;
GRANT SELECT ON public.support_tickets, public.support_messages, public.support_attachments TO authenticated;
REVOKE ALL ON public.support_email_outbox FROM authenticated;
GRANT ALL ON public.support_settings, public.support_categories, public.support_agents, public.support_customers,
  public.support_tickets, public.support_messages, public.support_attachments, public.support_email_outbox TO service_role;

-- ---------- Helpers (security definer, fixed search_path) ----------
CREATE FUNCTION public.support_is_manager(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS
$$ SELECT public.user_is_organization_admin(_org, auth.uid()) $$;
CREATE FUNCTION public.support_is_agent(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS
$$ SELECT public.user_is_organization_admin(_org, auth.uid())
   OR (public.user_is_organization_member(_org, auth.uid())
       AND EXISTS (SELECT 1 FROM public.support_agents a WHERE a.organization_id=_org AND a.user_id=auth.uid())) $$;
CREATE FUNCTION public.support_is_customer(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.support_customers c JOIN public.support_settings s ON s.organization_id=c.organization_id
   WHERE c.organization_id=_org AND c.user_id=auth.uid() AND c.revoked_at IS NULL AND s.portal_enabled) $$;
CREATE FUNCTION public.support_can_view_ticket(_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS
$$ SELECT EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id=_ticket AND (public.support_is_agent(t.organization_id)
   OR (t.requester_id=auth.uid() AND public.support_is_customer(t.organization_id)))) $$;
REVOKE ALL ON FUNCTION public.support_is_manager(uuid), public.support_is_agent(uuid), public.support_is_customer(uuid),
  public.support_can_view_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_is_manager(uuid), public.support_is_agent(uuid), public.support_is_customer(uuid),
  public.support_can_view_ticket(uuid) TO authenticated, service_role;

-- ---------- RLS ----------
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_email_outbox ENABLE ROW LEVEL SECURITY; -- no policies: service_role only

CREATE POLICY "Support settings visible to staff and customers" ON public.support_settings FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id) OR public.support_is_customer(organization_id));
CREATE POLICY "Managers create support settings" ON public.support_settings FOR INSERT TO authenticated
  WITH CHECK (public.support_is_manager(organization_id) AND next_ticket_number = 1);
CREATE POLICY "Managers update support settings" ON public.support_settings FOR UPDATE TO authenticated
  USING (public.support_is_manager(organization_id)) WITH CHECK (public.support_is_manager(organization_id));
CREATE POLICY "Categories visible to staff and customers" ON public.support_categories FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id) OR public.support_is_customer(organization_id));
CREATE POLICY "Managers add categories" ON public.support_categories FOR INSERT TO authenticated WITH CHECK (public.support_is_manager(organization_id));
CREATE POLICY "Managers edit categories" ON public.support_categories FOR UPDATE TO authenticated
  USING (public.support_is_manager(organization_id)) WITH CHECK (public.support_is_manager(organization_id));
CREATE POLICY "Staff see agents" ON public.support_agents FOR SELECT TO authenticated USING (public.support_is_agent(organization_id));
CREATE POLICY "Managers add agents who are company members" ON public.support_agents FOR INSERT TO authenticated
  WITH CHECK (public.support_is_manager(organization_id) AND added_by = auth.uid()
              AND public.user_is_organization_member(organization_id, user_id));
CREATE POLICY "Managers remove agents" ON public.support_agents FOR DELETE TO authenticated USING (public.support_is_manager(organization_id));
CREATE POLICY "Staff see customers; customers see own record" ON public.support_customers FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id) OR user_id = auth.uid());
CREATE POLICY "Managers invite customers" ON public.support_customers FOR INSERT TO authenticated
  WITH CHECK (public.support_is_manager(organization_id) AND invited_by = auth.uid() AND user_id IS NULL);
CREATE POLICY "Managers edit or revoke customers" ON public.support_customers FOR UPDATE TO authenticated
  USING (public.support_is_manager(organization_id)) WITH CHECK (public.support_is_manager(organization_id));
CREATE POLICY "Tickets visible to staff or own requester" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id) OR (requester_id = auth.uid() AND public.support_is_customer(organization_id)));
CREATE POLICY "Messages: staff all; customers public only" ON public.support_messages FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id)
         OR (NOT is_internal AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
              AND t.requester_id = auth.uid() AND public.support_is_customer(t.organization_id))));
CREATE POLICY "Attachments: staff all; customers public only" ON public.support_attachments FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id)
         OR (NOT is_internal AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
              AND t.requester_id = auth.uid() AND public.support_is_customer(t.organization_id))));

-- Guard: managers cannot rewrite the ticket counter; customers cannot be pointed at another account.
CREATE FUNCTION public.support_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF current_user <> 'service_role' AND NEW.next_ticket_number IS DISTINCT FROM OLD.next_ticket_number
     AND current_setting('support.counter', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'ticket counter is managed by the system';
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER support_settings_guard BEFORE UPDATE ON public.support_settings FOR EACH ROW EXECUTE FUNCTION public.support_settings_guard();
CREATE FUNCTION public.support_customers_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id OR NEW.email <> OLD.email
     OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND current_setting('support.claim', true) IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'customer company, email and linked account cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER support_customers_guard BEFORE UPDATE ON public.support_customers FOR EACH ROW EXECUTE FUNCTION public.support_customers_guard();

-- ---------- RPCs (the only write path for tickets/messages) ----------
CREATE FUNCTION public.support_notify(_user uuid, _title text, _msg text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS
$$ INSERT INTO public.notifications(user_id, title, message, type, read) VALUES (_user, left(_title,200), left(_msg,500), 'support', false) $$;
REVOKE ALL ON FUNCTION public.support_notify(uuid,text,text) FROM PUBLIC, anon, authenticated;

-- Customer claims invitations matching their signed-in (confirmed) email.
CREATE FUNCTION public.support_claim_invitations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _email text := lower(auth.jwt() ->> 'email'); n integer;
BEGIN
  IF auth.uid() IS NULL OR _email IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  PERFORM set_config('support.claim','on',true);
  UPDATE public.support_customers SET user_id = auth.uid()
   WHERE lower(email) = _email AND user_id IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('support.claim','off',true);
  RETURN n;
END $$;

CREATE FUNCTION public.support_create_ticket(_org uuid, _subject text, _description text, _category uuid, _priority text, _client_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _n integer; _staff boolean := public.support_is_agent(_org); _a record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF NOT (_staff OR public.support_is_customer(_org)) THEN RAISE EXCEPTION 'no support access for this company'; END IF;
  SELECT id INTO _id FROM public.support_tickets WHERE requester_id = auth.uid() AND client_request_id = _client_request_id;
  IF FOUND THEN RETURN _id; END IF; -- retry / double click returns the same ticket
  IF _category IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.support_categories WHERE id=_category AND organization_id=_org AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'unknown category'; END IF;
  IF NOT _staff AND (SELECT count(*) FROM public.support_tickets WHERE requester_id=auth.uid() AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'ticket limit reached, please try again later'; END IF;
  PERFORM set_config('support.counter','on',true);
  UPDATE public.support_settings SET next_ticket_number = next_ticket_number + 1 WHERE organization_id=_org
    RETURNING next_ticket_number - 1 INTO _n;
  PERFORM set_config('support.counter','off',true);
  IF _n IS NULL THEN RAISE EXCEPTION 'support is not set up for this company'; END IF;
  INSERT INTO public.support_tickets(organization_id, reference, subject, description, category_id, priority, requester_id, client_request_id)
  VALUES (_org, 'T-' || lpad(_n::text, 5, '0'), btrim(_subject), _description, _category, coalesce(_priority,'medium'), auth.uid(), _client_request_id)
  ON CONFLICT (requester_id, client_request_id) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN SELECT id INTO _id FROM public.support_tickets WHERE requester_id=auth.uid() AND client_request_id=_client_request_id; RETURN _id; END IF;
  INSERT INTO public.support_email_outbox(organization_id, ticket_id, kind, recipient_user_id, dedupe_key)
  VALUES (_org, _id, 'acknowledgement', auth.uid(), 'ack:' || _id) ON CONFLICT DO NOTHING;
  FOR _a IN SELECT DISTINCT u FROM (SELECT a.user_id u FROM public.support_agents a WHERE a.organization_id=_org
            UNION SELECT om.user_id FROM public.organization_members om WHERE om.organization_id=_org AND om.is_active AND om.role IN ('owner','admin')) x
            WHERE u <> auth.uid() LOOP
    PERFORM public.support_notify(_a.u, 'New support ticket', btrim(_subject));
  END LOOP;
  RETURN _id;
END $$;

CREATE FUNCTION public.support_add_message(_ticket uuid, _body text, _internal boolean, _client_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.support_tickets; _id uuid; _staff boolean;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id=_ticket FOR UPDATE;
  IF NOT FOUND OR NOT public.support_can_view_ticket(_ticket) THEN RAISE EXCEPTION 'ticket not found'; END IF; -- same reply for guessed IDs
  _staff := public.support_is_agent(t.organization_id);
  IF _internal AND NOT _staff THEN RAISE EXCEPTION 'only staff can add private notes'; END IF;
  SELECT id INTO _id FROM public.support_messages WHERE author_id=auth.uid() AND client_request_id=_client_request_id;
  IF FOUND THEN RETURN _id; END IF;
  IF t.status = 'closed' AND NOT _staff THEN RAISE EXCEPTION 'this ticket is closed; please open a new ticket'; END IF;
  INSERT INTO public.support_messages(ticket_id, organization_id, author_id, body, is_internal, client_request_id)
  VALUES (_ticket, t.organization_id, auth.uid(), _body, coalesce(_internal,false), _client_request_id) RETURNING id INTO _id;
  IF NOT coalesce(_internal,false) THEN
    UPDATE public.support_tickets SET updated_at = now(),
      status = CASE WHEN _staff THEN (CASE WHEN status='new' THEN 'open' ELSE status END)
                    WHEN status IN ('waiting_customer','resolved') THEN 'open' ELSE status END,
      resolved_at = CASE WHEN NOT _staff AND status='resolved' THEN NULL ELSE resolved_at END
    WHERE id=_ticket;
    IF _staff AND t.requester_id <> auth.uid() THEN
      INSERT INTO public.support_email_outbox(organization_id, ticket_id, message_id, kind, recipient_user_id, dedupe_key)
      VALUES (t.organization_id, _ticket, _id, 'public_reply', t.requester_id, 'reply:' || _id) ON CONFLICT DO NOTHING;
      PERFORM public.support_notify(t.requester_id, 'Reply on ' || t.reference, t.subject);
    ELSIF NOT _staff AND t.assignee_id IS NOT NULL THEN
      PERFORM public.support_notify(t.assignee_id, 'Customer replied on ' || t.reference, t.subject);
    END IF;
  ELSE
    UPDATE public.support_tickets SET updated_at = now() WHERE id=_ticket;
  END IF;
  RETURN _id;
END $$;

-- Staff: status, priority, category, assignee. Customers: reopen own resolved/closed ticket only.
CREATE FUNCTION public.support_update_ticket(_ticket uuid, _status text, _priority text, _category uuid, _assignee uuid, _set_assignee boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.support_tickets; _staff boolean;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id=_ticket FOR UPDATE;
  IF NOT FOUND OR NOT public.support_can_view_ticket(_ticket) THEN RAISE EXCEPTION 'ticket not found'; END IF;
  _staff := public.support_is_agent(t.organization_id);
  IF NOT _staff THEN
    IF _status = 'open' AND t.status IN ('resolved','closed') AND _priority IS NULL AND _category IS NULL AND NOT coalesce(_set_assignee,false) THEN
      UPDATE public.support_tickets SET status='open', resolved_at=NULL, closed_at=NULL, updated_at=now() WHERE id=_ticket; RETURN;
    END IF;
    RAISE EXCEPTION 'customers can only reopen their own resolved or closed tickets';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('new','open','waiting_customer','resolved','closed') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF _category IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.support_categories WHERE id=_category AND organization_id=t.organization_id) THEN
    RAISE EXCEPTION 'unknown category'; END IF;
  IF coalesce(_set_assignee,false) AND _assignee IS NOT NULL AND NOT (public.user_is_organization_admin(t.organization_id, _assignee)
     OR (public.user_is_organization_member(t.organization_id, _assignee)
         AND EXISTS (SELECT 1 FROM public.support_agents WHERE organization_id=t.organization_id AND user_id=_assignee))) THEN
    RAISE EXCEPTION 'assignee must be a support agent of this company'; END IF;
  UPDATE public.support_tickets SET
    status = coalesce(_status, status), priority = coalesce(_priority, priority), category_id = coalesce(_category, category_id),
    assignee_id = CASE WHEN coalesce(_set_assignee,false) THEN _assignee ELSE assignee_id END,
    resolved_at = CASE WHEN _status='resolved' THEN now() WHEN _status IN ('new','open','waiting_customer') THEN NULL ELSE resolved_at END,
    closed_at = CASE WHEN _status='closed' THEN now() WHEN _status IS NOT NULL AND _status<>'closed' THEN NULL ELSE closed_at END,
    updated_at = now()
  WHERE id=_ticket;
  IF coalesce(_set_assignee,false) AND _assignee IS NOT NULL AND _assignee IS DISTINCT FROM t.assignee_id AND _assignee <> auth.uid() THEN
    PERFORM public.support_notify(_assignee, 'Ticket assigned: ' || t.reference, t.subject);
  END IF;
END $$;

-- Records an uploaded file. Path must be <org>/<ticket>/<uuid>-<name>; private notes' files are staff-only.
CREATE FUNCTION public.support_add_attachment(_ticket uuid, _message uuid, _path text, _name text, _size integer, _mime text, _internal boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.support_tickets; _id uuid;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id=_ticket;
  IF NOT FOUND OR NOT public.support_can_view_ticket(_ticket) THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF _internal AND NOT public.support_is_agent(t.organization_id) THEN RAISE EXCEPTION 'only staff can attach to private notes'; END IF;
  IF split_part(_path,'/',1) <> t.organization_id::text OR split_part(_path,'/',2) <> _ticket::text THEN RAISE EXCEPTION 'invalid file path'; END IF;
  IF _message IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.support_messages WHERE id=_message AND ticket_id=_ticket AND author_id=auth.uid()) THEN
    RAISE EXCEPTION 'invalid message'; END IF;
  IF (SELECT count(*) FROM public.support_attachments WHERE ticket_id=_ticket) >= 20 THEN RAISE EXCEPTION 'attachment limit reached'; END IF;
  INSERT INTO public.support_attachments(ticket_id, message_id, organization_id, storage_path, file_name, size_bytes, mime_type, is_internal, uploaded_by)
  VALUES (_ticket, _message, t.organization_id, _path, _name, _size, _mime, coalesce(_internal,false), auth.uid())
  ON CONFLICT (storage_path) DO NOTHING RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.support_claim_invitations(), public.support_create_ticket(uuid,text,text,uuid,text,uuid),
  public.support_add_message(uuid,text,boolean,uuid), public.support_update_ticket(uuid,text,text,uuid,uuid,boolean),
  public.support_add_attachment(uuid,uuid,text,text,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_claim_invitations(), public.support_create_ticket(uuid,text,text,uuid,text,uuid),
  public.support_add_message(uuid,text,boolean,uuid), public.support_update_ticket(uuid,text,text,uuid,uuid,boolean),
  public.support_add_attachment(uuid,uuid,text,text,integer,text,boolean) TO authenticated;

-- ---------- Private storage: downloads only if the attachment row is visible ----------
CREATE POLICY "Support files: read if attachment visible" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND EXISTS (SELECT 1 FROM public.support_attachments a WHERE a.storage_path = name));
CREATE POLICY "Support files: upload into a visible ticket folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments'
    AND public.support_can_view_ticket(nullif(split_part(name,'/',2),'')::uuid)
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id::text = split_part(name,'/',2) AND t.organization_id::text = split_part(name,'/',1)));

COMMIT;
