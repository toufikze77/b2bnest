// HMRC P0: everything the Edge Functions read or write, behind one interface (in-memory in the tests, Supabase with the
// service role in the functions). Ciphertext only ever passes through here; never a plain token.
import type { HmrcEnvironment } from './config.ts';

export type ManageRule = 'ok' | 'not_signed_in' | 'not_member' | 'not_admin' | 'trial_ended' | 'suspended';
export type AuditEvent = 'connect_started' | 'connected' | 'refreshed' | 'refresh_failed' | 'disconnected' | 'refused';
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
    async audit(row) {
      const { error } = await admin.from('hmrc_audit_log').insert({ reason: null, ...row });
      must('hmrc_audit_log insert', error);
    },
  };
}
