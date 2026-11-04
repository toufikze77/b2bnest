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

  async getBusinessDetails(): Promise<HMRCBusinessDetails> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;
    const { data, error } = await supabase
      .from('hmrc_settings')
      .select('company_name, company_number, utr, vat_number, paye_reference')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return EMPTY;
    return {
      companyName: data.company_name || '', companyNumber: data.company_number || '', utr: data.utr || '',
      vatNumber: data.vat_number || '', payeReference: data.paye_reference || '',
    };
  },

  /** Saves the business details only. Returns false when the database update (docs/hmrc-p0) isn't applied yet. */
  async saveBusinessDetails(d: HMRCBusinessDetails): Promise<{ ok: boolean; needsUpdate?: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const row = { company_name: d.companyName, company_number: d.companyNumber, utr: d.utr, vat_number: d.vatNumber, paye_reference: d.payeReference };
    const { data: existing } = await supabase.from('hmrc_settings').select('id').eq('user_id', user.id).maybeSingle();
    const { error } = existing
      ? await supabase.from('hmrc_settings').update(row).eq('id', existing.id)
      // Before docs/hmrc-p0 the credential columns are NOT NULL, so a first save fails: say so instead of crashing.
      : await (supabase.from('hmrc_settings') as unknown as { insert: (r: unknown) => Promise<{ error: { code?: string } | null }> }).insert({ ...row, user_id: user.id });
    if (!error) return { ok: true };
    return { ok: false, needsUpdate: error.code === '23502' || error.code === '42501' };
  },
};

export type { EmployerDetails, HMRCBusinessDetails, SubmissionLog };
