import { supabase } from '@/integrations/supabase/client';

// HMRC P0: the browser never holds an HMRC token, client id or client secret (one B2BNEST HMRC application, server
// secrets only). The connection is in src/lib/hmrcConnection.ts. This file keeps the user's business details and the
// (empty) submission log reader. HMRC filing is not built: no submission API is called anywhere.

/** Used by the payroll screen (PAYE details, kept in the browser by that screen). */
type EmployerDetails = {
  payeReference: string; // e.g., 123/AB456
  accountsOfficeRef: string; // e.g., 123PA12345678
};

type HMRCBusinessDetails = {
  companyName: string;
  companyNumber: string;
  utr: string;
  vatNumber: string;
  payeReference: string;
};

type SubmissionLog = {
  id: string;
  submission_type: string;
  submission_id: string | null;
  period: string | null;
  status: string;
  submitted_at: string;
  error_message: string | null;
};

const EMPTY: HMRCBusinessDetails = { companyName: '', companyNumber: '', utr: '', vatNumber: '', payeReference: '' };

export const hmrcService = {
  async getSubmissionLogs(): Promise<SubmissionLog[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('hmrc_submission_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Failed to fetch submission logs:', error.code);
      return [];
    }
    return data || [];
  },

  /**
   * The business details for one company (Settings → HMRC). HMRC P3 fix (docs/hmrc-p3/README.md, "Fixed after
   * release"): the details belong to a company. Your row for that company; if you have none yet, your old row with no
   * company (shown once, so you can save it for this company). Never another company's row.
   */
  async getBusinessDetails(companyId: string): Promise<{ details: HMRCBusinessDetails; source: 'company' | 'unassigned' | 'none' }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !companyId) return { details: EMPTY, source: 'none' };
    const cols = 'company_name, company_number, utr, vat_number, paye_reference';
    const own = await supabase.from('hmrc_settings').select(cols).eq('user_id', user.id).eq('organization_id', companyId).maybeSingle();
    let data = own.error ? null : own.data;
    let source: 'company' | 'unassigned' | 'none' = data ? 'company' : 'none';
    if (!data && !own.error) {
      const old = await supabase.from('hmrc_settings').select(cols).eq('user_id', user.id).is('organization_id', null)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (!old.error && old.data) { data = old.data; source = 'unassigned'; }
    }
    if (!data) return { details: EMPTY, source: 'none' };
    return {
      source,
      details: {
        companyName: data.company_name || '', companyNumber: data.company_number || '', utr: data.utr || '',
        vatNumber: data.vat_number || '', payeReference: data.paye_reference || '',
      },
    };
  },

  /**
   * Saves the business details for one company: updates your row for that company, otherwise creates it (with the
   * company set). An old row with no company is left as it is. Returns needsUpdate when the database refuses.
   */
  async saveBusinessDetails(companyId: string, d: HMRCBusinessDetails): Promise<{ ok: boolean; needsUpdate?: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !companyId) return { ok: false };
    const row = { company_name: d.companyName, company_number: d.companyNumber, utr: d.utr, vat_number: d.vatNumber, paye_reference: d.payeReference };
    const { data: existing, error: readError } = await supabase.from('hmrc_settings').select('id').eq('user_id', user.id).eq('organization_id', companyId).maybeSingle();
    if (readError) return { ok: false };
    const { error } = existing
      ? await supabase.from('hmrc_settings').update(row).eq('id', existing.id)
      // Before docs/hmrc-p0 the credential columns are NOT NULL, so a first save fails: say so instead of crashing.
      : await (supabase.from('hmrc_settings') as unknown as { insert: (r: unknown) => Promise<{ error: { code?: string } | null }> })
        .insert({ ...row, user_id: user.id, organization_id: companyId });
    if (!error) return { ok: true };
    return { ok: false, needsUpdate: error.code === '23502' || error.code === '42501' };
  },
};

export type { EmployerDetails, HMRCBusinessDetails, SubmissionLog };
