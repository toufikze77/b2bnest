-- Marketing planning workspace — revised 2026-10-14. PROPOSAL: not applied to live.
-- Saved audiences, campaign drafts, planned content. Private to the creating user
-- (same rule as crm_contacts). Nothing here sends or tracks anything.
-- Additive only: creates 3 tables + 1 guard function. Touches no existing rows.

CREATE TABLE public.marketing_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  filter jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filter) = 'object'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  objective text CHECK (objective IS NULL OR length(objective) <= 2000),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','linkedin','phone','event','other')),
  content text CHECK (content IS NULL OR length(content) <= 20000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','completed')),
  start_date date,
  end_date date,
  audience_id uuid REFERENCES public.marketing_audiences(id) ON DELETE SET NULL,
  contact_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(contact_ids) <= 5000),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE public.marketing_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  channel text CHECK (channel IS NULL OR channel IN ('email','linkedin','phone','event','other')),
  planned_for date,
  todo_id uuid UNIQUE REFERENCES public.todos(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_audiences_user_idx ON public.marketing_audiences(user_id);
CREATE INDEX marketing_campaigns_user_idx ON public.marketing_campaigns(user_id);
CREATE INDEX marketing_content_user_idx ON public.marketing_content_items(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_audiences, public.marketing_campaigns, public.marketing_content_items TO authenticated;
GRANT ALL ON public.marketing_audiences, public.marketing_campaigns, public.marketing_content_items TO service_role;

ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own audiences" ON public.marketing_audiences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own campaigns" ON public.marketing_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own content" ON public.marketing_content_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Guard: ownership can never change; every referenced record must belong to the
-- row owner. Runs as definer so it can see referenced rows regardless of RLS.
CREATE OR REPLACE FUNCTION public.marketing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bad int; t record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Record ownership cannot be changed' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'marketing_campaigns' THEN
    IF NEW.audience_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.audience_id IS DISTINCT FROM OLD.audience_id)
       AND NOT EXISTS (SELECT 1 FROM marketing_audiences a WHERE a.id = NEW.audience_id AND a.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Audience not found' USING ERRCODE = '42501';
    END IF;
    NEW.contact_ids := ARRAY(SELECT DISTINCT unnest(NEW.contact_ids));
    IF TG_OP = 'INSERT' OR NEW.contact_ids IS DISTINCT FROM OLD.contact_ids THEN
      -- Only newly added IDs must exist and be owned; IDs of since-deleted contacts may stay.
      SELECT count(*) INTO bad FROM unnest(NEW.contact_ids) cid
        WHERE (TG_OP = 'INSERT' OR NOT cid = ANY(OLD.contact_ids))
          AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.id = cid AND c.user_id = NEW.user_id);
      IF bad > 0 THEN RAISE EXCEPTION 'One or more selected contacts are not yours' USING ERRCODE = '42501'; END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'marketing_content_items' THEN
    IF NEW.campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id)
       AND NOT EXISTS (SELECT 1 FROM marketing_campaigns c WHERE c.id = NEW.campaign_id AND c.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Campaign not found' USING ERRCODE = '42501';
    END IF;
    IF NEW.todo_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.todo_id IS DISTINCT FROM OLD.todo_id) THEN
      SELECT organization_id, user_id INTO t FROM todos WHERE id = NEW.todo_id;
      IF NOT FOUND
         OR (t.organization_id IS NULL AND t.user_id <> NEW.user_id)
         OR (t.organization_id IS NOT NULL AND NOT user_is_organization_member(t.organization_id, NEW.user_id)) THEN
        RAISE EXCEPTION 'Task not found or not accessible' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.marketing_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER t_ma_guard BEFORE INSERT OR UPDATE ON public.marketing_audiences FOR EACH ROW EXECUTE FUNCTION public.marketing_guard();
CREATE TRIGGER t_mc_guard BEFORE INSERT OR UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.marketing_guard();
CREATE TRIGGER t_mci_guard BEFORE INSERT OR UPDATE ON public.marketing_content_items FOR EACH ROW EXECUTE FUNCTION public.marketing_guard();
CREATE TRIGGER t_ma_upd BEFORE UPDATE ON public.marketing_audiences FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_mc_upd BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_mci_upd BEFORE UPDATE ON public.marketing_content_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
