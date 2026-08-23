import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DocumentTemplateId } from '@/lib/documentTemplates';

interface TemplatePrefs {
  invoice_template: DocumentTemplateId;
  quote_template: DocumentTemplateId;
}

const DEFAULTS: TemplatePrefs = {
  invoice_template: 'modern',
  quote_template: 'modern',
};

/** Loads and persists the user's default invoice/quote PDF templates. */
export const useDocumentTemplates = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<TemplatePrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setPrefs(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('user_document_templates')
      .select('invoice_template, quote_template')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPrefs({
        invoice_template: data.invoice_template || DEFAULTS.invoice_template,
        quote_template: data.quote_template || DEFAULTS.quote_template,
      });
    } else {
      setPrefs(DEFAULTS);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setDefaultTemplate = useCallback(
    async (documentType: 'quote' | 'invoice', templateId: DocumentTemplateId) => {
      const key = documentType === 'quote' ? 'quote_template' : 'invoice_template';
      const next = { ...prefs, [key]: templateId } as TemplatePrefs;
      setPrefs(next);
      if (!user) return;
      setSaving(true);
      const { error } = await (supabase as any)
        .from('user_document_templates')
        .upsert(
          { user_id: user.id, ...next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      setSaving(false);
      if (error) throw error;
    },
    [prefs, user],
  );

  const templateFor = useCallback(
    (documentType: 'quote' | 'invoice') =>
      documentType === 'quote' ? prefs.quote_template : prefs.invoice_template,
    [prefs],
  );

  return { prefs, loading, saving, setDefaultTemplate, templateFor, reload: load };
};
