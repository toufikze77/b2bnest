-- PROPOSAL ONLY — not applied. Campaign drafts, saved audiences, planned content.
-- Private to the creating user (same rule as crm_contacts). No sending, no tracking columns.
CREATE TABLE public.marketing_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  objective text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','linkedin','phone','event','other')),
  content text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','in_progress','done')),
  start_date date,
  end_date date,
  audience_id uuid REFERENCES public.marketing_audiences(id) ON DELETE SET NULL,
  contact_ids uuid[] NOT NULL DEFAULT '{}',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketing_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  channel text,
  planned_for date,
  todo_id uuid,               -- follow-up task in the existing todos table
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_audiences, public.marketing_campaigns, public.marketing_content_items TO authenticated;
GRANT ALL ON public.marketing_audiences, public.marketing_campaigns, public.marketing_content_items TO service_role;
ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own audiences" ON public.marketing_audiences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own campaigns" ON public.marketing_campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own content" ON public.marketing_content_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_ma_upd BEFORE UPDATE ON public.marketing_audiences FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_mc_upd BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER t_mci_upd BEFORE UPDATE ON public.marketing_content_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- App must only store contact_ids the user can read; RLS on crm_contacts still hides others' contacts.
