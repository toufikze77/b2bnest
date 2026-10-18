-- Phase 7: real in-app notifications and note reminders — PROPOSAL, NOT APPLIED. Target when approved: gvftvswyrevummbvyhxa.
-- Safe to re-run (every statement is IF NOT EXISTS / CREATE OR REPLACE / guarded). One transaction: any failure leaves nothing.
-- No statement deletes or rewrites existing data. No email is sent by anything here (in-app notifications only).
-- Nothing is scheduled by this file: the pg_cron statements at the end are comments for the owner to run after approval.
--
-- Read-only facts from production (2026-10-18) this proposal relies on:
--   notifications: id, user_id (not null), title, message, type (nullable), read (nullable), created_at; RLS SELECT/UPDATE own rows,
--   no INSERT policy. Types in use: 'welcome' (3), 'info' (1); the repo also writes 'support', 'task_shared', 'project_shared'
--   and others from older migrations. => A CHECK on `type` limited to the new list would reject existing rows and existing
--   writers, so NO type CHECK is added. The new types are validated inside public._notify() instead.
--   invoices statuses: sent 3, paid 1. quotes: draft 9. notes: 2 with a reminder already in the past (they will notify once on the
--   first run), 2 without. Existing triggers on these tables: only the updated_at ones.
BEGIN;

-- 1. notifications: in-app link, de-duplication key, indexes --------------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_link_in_app' AND conrelid = 'public.notifications'::regclass) THEN
    -- In-app paths only: starts with one "/" (never "//host" or "/\host"), no spaces or control characters, at most 500 chars.
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_link_in_app
      CHECK (link IS NULL OR (length(link) <= 500 AND link ~ '^/([^/\\]|$)' AND link !~ '[[:space:][:cntrl:]]'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_dedupe_key_len' AND conrelid = 'public.notifications'::regclass) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_dedupe_key_len CHECK (dedupe_key IS NULL OR length(dedupe_key) <= 200);
  END IF;
END $$;
-- A job can never create the same notification twice for the same person.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
-- The bell: a person's unread count and latest rows.
CREATE INDEX IF NOT EXISTS notifications_user_read_created ON public.notifications (user_id, read, created_at DESC);

-- 2. Per-type in-app preferences (no row = on) ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_type_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('invoice_overdue', 'invoice_paid', 'quote_update', 'note_reminder')),
  in_app boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);
ALTER TABLE public.notification_type_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_type_prefs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_type_prefs TO authenticated;
GRANT ALL ON public.notification_type_prefs TO service_role;
DROP POLICY IF EXISTS "Own notification type prefs: read" ON public.notification_type_prefs;
DROP POLICY IF EXISTS "Own notification type prefs: add" ON public.notification_type_prefs;
DROP POLICY IF EXISTS "Own notification type prefs: change" ON public.notification_type_prefs;
DROP POLICY IF EXISTS "Own notification type prefs: remove" ON public.notification_type_prefs;
CREATE POLICY "Own notification type prefs: read" ON public.notification_type_prefs FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Own notification type prefs: add" ON public.notification_type_prefs FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Own notification type prefs: change" ON public.notification_type_prefs FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Own notification type prefs: remove" ON public.notification_type_prefs FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 3. Helpers (server only) --------------------------------------------------------------------------------------------------
-- Today's date where the owner is: profiles.timezone when it is a valid zone name, otherwise Europe/London.
CREATE OR REPLACE FUNCTION public._notification_today(_user uuid) RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tz text;
BEGIN
  SELECT nullif(btrim(p.timezone), '') INTO tz FROM public.profiles p WHERE p.id = _user;
  BEGIN
    RETURN (now() AT TIME ZONE coalesce(tz, 'Europe/London'))::date;
  EXCEPTION WHEN OTHERS THEN -- unknown zone name
    RETURN (now() AT TIME ZONE 'Europe/London')::date;
  END;
END $$;

-- True when this person has not switched this type off (no row = on).
CREATE OR REPLACE FUNCTION public._notification_wanted(_user uuid, _type text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.notification_type_prefs p WHERE p.user_id = _user AND p.type = _type AND p.in_app = false)
$$;

-- Inserts one notification unless: no user, unknown type, switched off, or the same dedupe key already exists. Returns true if inserted.
CREATE OR REPLACE FUNCTION public._notify(_user uuid, _type text, _title text, _message text, _link text, _dedupe text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF _user IS NULL OR _dedupe IS NULL THEN RETURN false; END IF;
  IF _type NOT IN ('invoice_overdue', 'invoice_paid', 'quote_update', 'note_reminder') THEN RETURN false; END IF;
  IF NOT public._notification_wanted(_user, _type) THEN RETURN false; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, read, link, dedupe_key)
  VALUES (_user, left(_title, 200), left(_message, 500), _type, false, _link, left(_dedupe, 200))
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN FOUND;
END $$;

-- "1,250.00 GBP": the document's own amount and currency, never converted.
CREATE OR REPLACE FUNCTION public._notification_money(_amount numeric, _currency text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT btrim(to_char(coalesce(_amount, 0), 'FM999,999,999,990.00')) || coalesce(' ' || upper(nullif(btrim(_currency), '')), '')
$$;

-- 4. The generator (run by pg_cron every 15 minutes once approved) ---------------------------------------------------------
-- Idempotent: every notification has a dedupe key, and rows already notified (or switched off) are not even selected, so a
-- long backlog is worked through in order across runs. At most _limit rows per run (default 500, never more than 5000).
CREATE OR REPLACE FUNCTION public.generate_due_notifications(_limit integer DEFAULT 500) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  budget integer := greatest(1, least(coalesce(_limit, 500), 5000));
  r record;
  n_inv integer := 0;
  n_note integer := 0;
  key text;
BEGIN
  -- Overdue invoices: not archived; status not paid / cancelled / void / draft (the app's own rule); due before the owner's today.
  FOR r IN
    SELECT i.id, i.user_id, i.invoice_number, i.total_amount, i.currency, i.due_date::date AS due, i.client_name
    FROM public.invoices i
    WHERE i.archived_at IS NULL AND i.user_id IS NOT NULL AND i.due_date IS NOT NULL
      AND lower(btrim(coalesce(i.status, ''))) NOT IN ('', 'draft', 'paid', 'cancelled', 'canceled', 'void')
      AND i.due_date::date < public._notification_today(i.user_id)
      AND public._notification_wanted(i.user_id, 'invoice_overdue')
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = i.user_id AND n.dedupe_key = 'invoice_overdue:' || i.id::text)
    ORDER BY i.due_date, i.id
    LIMIT budget
  LOOP
    IF public._notify(r.user_id, 'invoice_overdue',
         'Invoice ' || r.invoice_number || ' (' || public._notification_money(r.total_amount, r.currency) || ') is overdue',
         coalesce(nullif(btrim(r.client_name), '') || '. ', '') || 'It was due on ' || to_char(r.due, 'FMDD Mon YYYY') || ' and is not marked paid.',
         '/business-tools?tool=business-finance-assistant&tab=invoices',
         'invoice_overdue:' || r.id::text) THEN
      n_inv := n_inv + 1;
    END IF;
  END LOOP;

  -- Note reminders: not archived, not a template, reminder time passed. The key includes the reminder time, so moving the
  -- reminder to a new time can notify again, and the same time never notifies twice.
  FOR r IN
    SELECT nt.id, nt.user_id, nt.title, nt.reminder_date,
           'note_reminder:' || nt.id::text || ':' || floor(extract(epoch FROM nt.reminder_date))::bigint::text AS dkey
    FROM public.notes nt
    WHERE coalesce(nt.is_archived, false) = false AND coalesce(nt.is_template, false) = false
      AND nt.user_id IS NOT NULL AND nt.reminder_date IS NOT NULL AND nt.reminder_date <= now()
      AND public._notification_wanted(nt.user_id, 'note_reminder')
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = nt.user_id
                        AND n.dedupe_key = 'note_reminder:' || nt.id::text || ':' || floor(extract(epoch FROM nt.reminder_date))::bigint::text)
    ORDER BY nt.reminder_date, nt.id
    LIMIT greatest(0, budget - n_inv)
  LOOP
    IF public._notify(r.user_id, 'note_reminder',
         'Reminder: ' || coalesce(nullif(btrim(r.title), ''), 'Untitled note'),
         'You asked to be reminded about this note.',
         '/business-tools/notepro?note=' || r.id::text,
         r.dkey) THEN
      n_note := n_note + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('invoice_overdue', n_inv, 'note_reminder', n_note, 'limit', budget, 'ran_at', now());
END $$;

-- 5. Event triggers: never block or roll back the invoice / quote update --------------------------------------------------
-- Cost: the triggers fire only when `status` actually changes (WHEN clause), do one indexed insert, and catch every error
-- (a failed notification only raises a WARNING in the logs; the invoice or quote change always goes through).
CREATE OR REPLACE FUNCTION public.notify_invoice_paid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    IF lower(btrim(coalesce(NEW.status, ''))) = 'paid' AND lower(btrim(coalesce(OLD.status, ''))) <> 'paid' AND NEW.archived_at IS NULL THEN
      PERFORM public._notify(NEW.user_id, 'invoice_paid',
        'Invoice ' || NEW.invoice_number || ' (' || public._notification_money(NEW.total_amount, NEW.currency) || ') is marked paid',
        coalesce(nullif(btrim(NEW.client_name), '') || '. ', '') || 'Recorded in B2BNEST. No email was sent.',
        '/business-tools?tool=business-finance-assistant&tab=invoices',
        'invoice_paid:' || NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_invoice_paid skipped for invoice %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_quote_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s text;
BEGIN
  BEGIN
    s := lower(btrim(coalesce(NEW.status, '')));
    IF s <> '' AND s <> lower(btrim(coalesce(OLD.status, ''))) AND NEW.archived_at IS NULL THEN
      PERFORM public._notify(NEW.user_id, 'quote_update',
        'Quote ' || NEW.quote_number || ' is now ' || s,
        coalesce(nullif(btrim(NEW.client_name), '') || '. ', '') || public._notification_money(NEW.total_amount, NEW.currency) || '.',
        '/business-tools?tool=business-finance-assistant&tab=quotes',
        'quote_update:' || NEW.id::text || ':' || left(s, 40));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_quote_update skipped for quote %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER invoices_notify_paid AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.notify_invoice_paid();
CREATE OR REPLACE TRIGGER quotes_notify_update AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.notify_quote_update();

-- 6. Who can run what: server only -----------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_due_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notify(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notification_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notification_wanted(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notification_money(numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_invoice_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_quote_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_notifications(integer) TO service_role;

COMMIT;

-- 7. Schedules — NOT RUN by this file. The owner runs these by hand after approving and applying the above. -----------------
-- Generator, every 15 minutes:
--   SELECT cron.schedule('b2bnest-generate-due-notifications', '*/15 * * * *', $job$SELECT public.generate_due_notifications();$job$);
--
-- OPTIONAL, separate decision (deletes old notifications; skip it to keep everything):
-- read notifications older than 90 days and unread ones older than 180 days, daily at 03:17 UTC.
--   SELECT cron.schedule('b2bnest-notifications-retention', '17 3 * * *', $job$
--     DELETE FROM public.notifications
--     WHERE (read IS TRUE AND created_at < now() - interval '90 days')
--        OR (coalesce(read, false) = false AND created_at < now() - interval '180 days');
--   $job$);
