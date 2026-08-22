CREATE TABLE public.user_document_templates (
  user_id UUID NOT NULL PRIMARY KEY,
  invoice_template TEXT NOT NULL DEFAULT 'modern',
  quote_template TEXT NOT NULL DEFAULT 'modern',
  accent_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_document_templates TO authenticated;
GRANT ALL ON public.user_document_templates TO service_role;

ALTER TABLE public.user_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own document template preferences"
ON public.user_document_templates FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_document_templates_updated_at
BEFORE UPDATE ON public.user_document_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();