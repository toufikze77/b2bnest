// Phase 39: marketing email consent (UK GDPR / PECR). Phase 39b: the sign-up form no longer asks; people opt in with
// the switch in Settings → Notifications (off by default). The choice is recorded on the server (public.marketing_consents, docs/phase39/proposal.sql) with the server's clock and the
// wording version. Only consented = true may be emailed for marketing. No marketing email is sent by this change.
import { supabase } from '@/integrations/supabase/client';
import { isSavableTool } from '@/lib/freeToolItems';

export const CONSENT_TEXT = 'Send me tips and offers about B2BNEST. You can unsubscribe at any time.';
export const CONSENT_VERSION = 'v1';
export const CONSENT_NEEDS_DB = 'Saving this choice needs a database update. Nothing has changed yet.';
export const CONSENT_FAILED = "Couldn't save your choice. Check your connection and try again.";

/** The free tool someone signed up from (next=/business-tools?tool=<tool>), else 'signup'. Nothing else is kept. */
export function signupSourceFromNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/business-tools')) return 'signup';
  try {
    const tool = new URLSearchParams(next.split('?')[1] ?? '').get('tool');
    return isSavableTool(tool) ? tool : 'signup';
  } catch { return 'signup'; }
}

/**
 * What Supabase Auth keeps in the new account's sign-up details: only the free tool signed up from (Phase 39b).
 * marketing_consent_record_signup() reads it once; with docs/phase39b applied it records consented = false with that
 * source, before that nothing (no error either way).
 */
export const signupSourceMetadata = (next: string | null | undefined) => ({ signup_source: signupSourceFromNext(next) });

type RpcError = { code?: string; message?: string } | null;
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }>;
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as unknown as Rpc)(fn, args);
const isMissing = (e: RpcError) => !!e && (e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST205' || e.code === '42P01'
  || /could not find the (function|table)/i.test(e.message ?? ''));

export interface ConsentState { consented: boolean; updatedAt: string | null }
export interface ConsentResult { ok: boolean; value?: ConsentState | null; error?: string; missing?: boolean }

/** Your own row (null = no choice recorded yet). */
export async function readConsent(userId: string): Promise<ConsentResult> {
  try {
    const q = (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: RpcError }> } } } })
      .from('marketing_consents').select('consented, updated_at').eq('user_id', userId).maybeSingle();
    const { data, error } = await q;
    if (error) return { ok: false, error: isMissing(error) ? CONSENT_NEEDS_DB : CONSENT_FAILED, missing: isMissing(error) };
    const row = data as { consented: boolean; updated_at: string } | null;
    return { ok: true, value: row ? { consented: row.consented, updatedAt: row.updated_at } : null };
  } catch { return { ok: false, error: CONSENT_FAILED }; }
}

export async function setConsent(consented: boolean): Promise<ConsentResult> {
  try {
    const { data, error } = await rpc('marketing_consent_set', { p_consented: consented, p_source: 'settings' });
    if (error) return { ok: false, error: isMissing(error) ? CONSENT_NEEDS_DB : CONSENT_FAILED, missing: isMissing(error) };
    const row = data as { consented: boolean; updated_at: string };
    return { ok: true, value: { consented: !!row?.consented, updatedAt: row?.updated_at ?? null } };
  } catch { return { ok: false, error: CONSENT_FAILED }; }
}

/** After signing in: record the sign-up choice once (the server ignores it if a choice exists). Errors are ignored. */
export async function recordSignupConsent(): Promise<void> {
  try { await rpc('marketing_consent_record_signup'); } catch { /* before the SQL is applied, or offline: tried again next sign-in */ }
}
