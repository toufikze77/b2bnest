// HMRC P6: the database side of hmrc-vat-submit. Writes go through the service role (the table has no browser write
// grant); the recomputation runs public.vat_company_return_preview as the CALLER (their JWT), so their own access rules
// (owner/admin, plan, two-step) apply to the figures too. Nothing here logs a value; errors carry a code only.
import type { PreviewResult, SubmissionRow, SubmitStore } from './vatSubmit.ts';
import type { PreviewRow } from '../vat/returnBoxes.ts';

type Result = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
type Query = Result & { [k: string]: (...a: unknown[]) => Query };
type Sb = { rpc: (fn: string, args: Record<string, unknown>) => Result; from: (t: string) => Query };
const must = (what: string, error: { code?: string } | null) => {
  if (error) throw new Error(`${what} failed (${error.code ?? 'error'})`);
};

export function supabaseSubmitStore(admin: Sb): SubmitStore {
  return {
    async begin(r) {
      const { data, error } = await admin.rpc('hmrc_begin_vat_submission', {
        p_company: r.company_id, p_user: r.user_id, p_environment: r.environment, p_period_key: r.period_key, p_period_start: r.period_start,
        p_period_end: r.period_end, p_figures: r.figures, p_figures_hash: r.figures_hash, p_request_id: r.request_id, p_vrn_last3: r.vrn_last3,
        p_test_scenario: r.test_scenario, p_user_name: r.user_name, p_limit: r.limit,
      });
      must('hmrc_begin_vat_submission', error);
      const row = (Array.isArray(data) ? data[0] : data) as { result: 'ok' | 'limit' | 'already_live' | 'bad_request'; submission_id: string | null } | null;
      return { result: row?.result ?? 'bad_request', id: row?.submission_id ?? null };
    },
    async finish(id, patch) {
      const { error } = await admin.from('hmrc_vat_submissions').update(patch).eq('id', id);
      must('hmrc_vat_submissions update', error);
    },
    async live(companyId, environment, periodKey) {
      const { data, error } = await admin.from('hmrc_vat_submissions')
        .select('id, status, period_key, period_start, period_end, figures_hash, form_bundle_number, processing_date')
        .eq('organization_id', companyId).eq('environment', environment).eq('period_key', periodKey)
        .in('status', ['submitting', 'unknown', 'accepted']).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
      must('hmrc_vat_submissions select', error);
      return (data as SubmissionRow | null) ?? null;
    },
    async displayName(userId) {
      const { data, error } = await admin.from('profiles').select('display_name, full_name').eq('id', userId).maybeSingle();
      if (error) return null;
      const p = data as { display_name?: string | null; full_name?: string | null } | null;
      return (p?.display_name?.trim() || p?.full_name?.trim() || null)?.slice(0, 120) ?? null;
    },
  };
}

/** Maps the P5 function's refusals (docs/hmrc-p5/proposal.sql) to our codes. */
export function previewFailure(e: { code?: string; message?: string }): Exclude<PreviewResult, { ok: true }>['code'] {
  const m = e.message ?? '';
  if (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(m)) return 'preview_not_available';
  if (/VAT_PREVIEW_PLAN/.test(m)) return 'plan_not_included';
  if (/authenticator code/i.test(m)) return 'two_step_required';
  if (/VAT_PREVIEW_DENIED/.test(m) || e.code === '42501') return 'preview_denied';
  return 'server_error';
}

export function previewWithCallerJwt(userClient: (jwt: string) => Sb) {
  return async (jwt: string, companyId: string, from: string, to: string): Promise<PreviewResult> => {
    const { data, error } = await userClient(jwt).rpc('vat_company_return_preview', { p_organization_id: companyId, p_from: from, p_to: to });
    if (error) return { ok: false, code: previewFailure(error) };
    return { ok: true, rows: Array.isArray(data) ? (data as PreviewRow[]) : [] };
  };
}
