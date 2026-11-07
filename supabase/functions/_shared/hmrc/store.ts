// HMRC P0: everything the Edge Functions read or write, behind one interface (in-memory in the tests, Supabase with the
// service role in the functions). Ciphertext only ever passes through here; never a plain token.
import type { HmrcEnvironment } from './config.ts';

// plan_not_included: a paying account whose plan is not Business or Scale (docs/hmrc-plan/proposal.sql).
export type ManageRule = 'ok' | 'not_signed_in' | 'not_member' | 'not_admin' | 'trial_ended' | 'suspended' | 'plan_not_included';
export type AuditEvent = 'connect_started' | 'connected' | 'refreshed' | 'refresh_failed' | 'disconnected' | 'refused' | 'test_call' | 'test_result'
  | 'obligations_call' | 'obligations_result';
export interface ConnectionRow {
  company_id: string;
  environment: HmrcEnvironment;
  status: 'connected' | 'needs_reconnect' | 'disconnected';
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[];
}
export interface HmrcStore {
  manageAllowed(companyId: string, userId: string): Promise<ManageRule>;
  createState(row: { state_hash: string; user_id: string; company_id: string; environment: HmrcEnvironment; expires_at: string }): Promise<void>;
  consumeState(stateHash: string, userId: string): Promise<{ company_id: string; environment: HmrcEnvironment } | null>;
  saveConnection(row: ConnectionRow & { connected_by: string | null; connected_at: string | null }): Promise<void>;
  getConnection(companyId: string, environment: HmrcEnvironment): Promise<ConnectionRow | null>;
  updateConnection(companyId: string, environment: HmrcEnvironment, patch: Partial<ConnectionRow> & { refresh_lock_until?: string | null }): Promise<void>;
  claimRefresh(companyId: string, environment: HmrcEnvironment, seconds: number): Promise<boolean>;
  audit(row: { company_id: string; user_id: string | null; environment: HmrcEnvironment | null; event: AuditEvent; reason?: string | null }): Promise<void>;
  /** HMRC P1: one test call for the company, if under its hourly limit (writes the test_call audit row). */
  takeTestSlot(companyId: string, userId: string, environment: HmrcEnvironment, kind: string): Promise<boolean>;
  /** HMRC P3: one obligations read for the company, if under its hourly limit (writes the obligations_call row). */
  takeObligationsSlot(companyId: string, userId: string, environment: HmrcEnvironment, kind: string): Promise<boolean>;
  /**
   * HMRC P3: the company's saved VAT number (hmrc_settings.vat_number), as typed. See pickVatNumber for the rule.
   * Null when there is none.
   */
  vatNumberFor(companyId: string, userId: string): Promise<string | null>;
}

export interface VatRow { user_id: string; organization_id: string | null; vat_number: string | null; updated_at?: string | null }
const hasVat = (r: VatRow) => typeof r.vat_number === 'string' && r.vat_number.trim() !== '';
/**
 * Which business details give the company's VAT number (docs/hmrc-p3/README.md, "Fixed after release"):
 *   1. the caller's own row for this company;
 *   2. otherwise the newest row for this company saved by someone who is now an owner or admin of it
 *      (a row a member saved is never used);
 *   3. otherwise the caller's own row with no company set (details saved before they belonged to a company).
 * A row for another company is never used.
 */
export function pickVatNumber(companyId: string, userId: string, rows: VatRow[], adminIds: string[]): string | null {
  const company = rows.filter((r) => r.organization_id === companyId && hasVat(r));
  const own = company.find((r) => r.user_id === userId);
  if (own) return own.vat_number;
  const byAdmin = company.filter((r) => adminIds.includes(r.user_id)).sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0];
  if (byAdmin) return byAdmin.vat_number;
  const unassigned = rows.find((r) => r.user_id === userId && r.organization_id === null && hasVat(r));
  return unassigned ? unassigned.vat_number : null;
}

// The subset of the Supabase client used here (kept loose on purpose: the real client's generics are not needed).
type Result = PromiseLike<{ data: unknown; error: { code?: string } | null }>;
type Query = Result & { [k: string]: (...a: unknown[]) => Query };
type Sb = { rpc: (fn: string, args: Record<string, unknown>) => Result; from: (t: string) => Query };
const must = (what: string, error: { code?: string } | null) => {
  if (error) throw new Error(`${what} failed (${error.code ?? 'error'})`); // the code only, never the details
};

export function supabaseStore(admin: Sb): HmrcStore {
  return {
    async manageAllowed(companyId, userId) {
      const { data, error } = await admin.rpc('hmrc_manage_allowed', { p_company: companyId, p_user: userId });
      must('hmrc_manage_allowed', error);
      return data as ManageRule;
    },
    async createState(row) {
      const { error } = await admin.from('hmrc_oauth_states').insert(row);
      must('hmrc_oauth_states insert', error);
    },
    async consumeState(stateHash, userId) {
      const { data, error } = await admin.rpc('hmrc_consume_state', { p_state_hash: stateHash, p_user: userId });
      must('hmrc_consume_state', error);
      const row = (Array.isArray(data) ? data[0] : data) as { company_id: string; environment: HmrcEnvironment } | null;
      return row ? { company_id: row.company_id, environment: row.environment } : null;
    },
    async saveConnection(row) {
      const { error } = await admin.from('hmrc_connections').upsert({ ...row, refresh_lock_until: null }, { onConflict: 'company_id,environment' });
      must('hmrc_connections upsert', error);
    },
    async getConnection(companyId, environment) {
      const { data, error } = await admin.from('hmrc_connections')
        .select('company_id, environment, status, access_token_enc, refresh_token_enc, expires_at, scopes')
        .eq('company_id', companyId).eq('environment', environment).maybeSingle();
      must('hmrc_connections select', error);
      return (data as ConnectionRow | null) ?? null;
    },
    async updateConnection(companyId, environment, patch) {
      const { error } = await admin.from('hmrc_connections').update(patch).eq('company_id', companyId).eq('environment', environment);
      must('hmrc_connections update', error);
    },
    async claimRefresh(companyId, environment, seconds) {
      const { data, error } = await admin.rpc('hmrc_claim_refresh', { p_company: companyId, p_environment: environment, p_seconds: seconds });
      must('hmrc_claim_refresh', error);
      return data === true;
    },
    async takeTestSlot(companyId, userId, environment, kind) {
      const { data, error } = await admin.rpc('hmrc_take_test_slot', { p_company: companyId, p_user: userId, p_environment: environment, p_kind: kind });
      must('hmrc_take_test_slot', error);
      return data === true;
    },
    async takeObligationsSlot(companyId, userId, environment, kind) {
      const { data, error } = await admin.rpc('hmrc_take_obligations_slot', { p_company: companyId, p_user: userId, p_environment: environment, p_kind: kind });
      must('hmrc_take_obligations_slot', error);
      return data === true;
    },
    async vatNumberFor(companyId, userId) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuid.test(companyId) || !uuid.test(userId)) return null; // both go into a filter string
      const rows = await admin.from('hmrc_settings').select('user_id, organization_id, vat_number, updated_at')
        .or(`organization_id.eq.${companyId},and(user_id.eq.${userId},organization_id.is.null)`);
      must('hmrc_settings select', rows.error);
      const admins = await admin.from('organization_members').select('user_id')
        .eq('organization_id', companyId).in('role', ['owner', 'admin']).eq('is_active', true);
      must('organization_members select', admins.error);
      return pickVatNumber(companyId, userId, (rows.data ?? []) as VatRow[], ((admins.data ?? []) as { user_id: string }[]).map((a) => a.user_id));
    },
    async audit(row) {
      const { error } = await admin.from('hmrc_audit_log').insert({ reason: null, ...row });
      must('hmrc_audit_log insert', error);
    },
  };
}
