// Client for AI template generation. Price, balance, user and company are decided on the
// server; nothing sent from here is trusted. Tables below exist only after the staging
// migration is applied, so every read degrades to "not available" when they are missing.
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AiGenerationConfig {
  paid_generation_enabled: boolean;
  customer_price_credits: number | null;
  admin_price_credits: number | null;
  admin_budget_cap: number;
  admin_budget_used: number;
  admin_provider_spend_cap_pence: number;
}

export type ConfigState =
  | { state: 'unavailable' }
  | { state: 'ready'; config: AiGenerationConfig };

export async function loadAiConfig(): Promise<ConfigState> {
  const { data, error } = await db.from('ai_generation_config').select('*').maybeSingle();
  if (error || !data) return { state: 'unavailable' };
  return { state: 'ready', config: data as AiGenerationConfig };
}

export interface Brief {
  businessPurpose: string;
  desiredBoards: string;
  taskStructure: string;
  kind: 'project' | 'workspace' | 'auto';
}

export interface GenerateResult {
  ok: boolean;
  status: number;
  error?: string;
  refunded?: boolean;
  template?: unknown;
  templateId?: string;
  duplicate?: boolean;
  cost?: number;
  creditsRemaining?: number;
}

async function invoke(body: unknown): Promise<{ status: number; data: any }> {
  const { data, error } = await supabase.functions.invoke('generate-template', { body });
  if (!error) return { status: 200, data };
  // FunctionsHttpError carries the response; read the JSON error body.
  const ctx = (error as { context?: Response }).context;
  let parsed: any = null;
  try { parsed = ctx ? await ctx.json() : null; } catch { /* ignore */ }
  return { status: ctx?.status ?? 500, data: parsed ?? { error: 'network_error' } };
}

/** One click = one request key. A new click (regenerate) is a new request and a new charge. */
export async function generateTemplate(organizationId: string, idempotencyKey: string, brief: Brief, purpose: 'customer' | 'admin_catalogue' = 'customer'): Promise<GenerateResult> {
  const { status, data } = await invoke({ mode: 'generate', purpose, organizationId, idempotencyKey, brief });
  return { ok: status === 200 && data?.status === 'settled', status, ...data };
}

export interface ProbeResult {
  outcome: string; inputTokens: number; outputTokens: number; costUsdMicros: number; latencyMs: number;
  errors?: string[]; status?: number; template?: any; spendRecorded: boolean;
}

export interface ProbeInfo {
  model: string; maxCalls: number; maxOutputTokens: number; usdToGbp: number;
  worstCasePencePerCall: number; worstCasePence: number; spentPenceThisMonth: number; capPence: number;
  setupComplete: boolean; setupError?: string;
}

/** Server-side preflight: model, call count, worst-case spend, cap and whether recording is installed. */
export async function loadProbeInfo(calls: number): Promise<{ status: number; info?: ProbeInfo; error?: string }> {
  const { status, data } = await invoke({ mode: 'probe_info' });
  if (status !== 200) return { status, error: data?.error ?? 'unavailable' };
  const info = data as ProbeInfo;
  // Server reports the 8-call maximum; scale to the briefs actually sent.
  const scaled = Math.round(info.worstCasePencePerCall * calls * 1000) / 1000;
  return { status, info: { ...info, maxCalls: calls, worstCasePence: scaled } };
}

export async function runCostProbe(briefs: Brief[]): Promise<{ status: number; model?: string; results?: ProbeResult[]; error?: string; setupError?: string }> {
  const { status, data } = await invoke({ mode: 'cost_probe', briefs });
  return { status, ...data };
}

export interface GeneratedTemplateRow {
  id: string; name: string; review_status: string; scope: string; created_at: string;
  owner_user_id: string; organization_id: string; definition: unknown; review_note: string | null;
}

export async function listGeneratedTemplates(filter?: { reviewStatus?: string }): Promise<{ ok: boolean; rows: GeneratedTemplateRow[] }> {
  let q = db.from('generated_templates').select('*').order('created_at', { ascending: false }).limit(100);
  if (filter?.reviewStatus) q = q.eq('review_status', filter.reviewStatus);
  const { data, error } = await q;
  return error ? { ok: false, rows: [] } : { ok: true, rows: data ?? [] };
}

export async function reviewGeneratedTemplate(id: string, approve: boolean, note: string) {
  const { data, error } = await db.rpc('review_generated_template', { p_template: id, p_approve: approve, p_note: note });
  return !error && data === true;
}

export async function submitGeneratedTemplate(id: string) {
  const { data, error } = await db.rpc('submit_generated_template', { p_template: id });
  return !error && data === true;
}

export const ERROR_TEXT: Record<string, string> = {
  generation_disabled: "AI template creation isn't switched on yet.",
  insufficient_credits: "You don't have enough AI credits for this.",
  not_company_member: "You're not a member of the selected company.",
  price_not_set: "A price hasn't been set yet.",
  invalid_output: "The AI's answer didn't meet our template rules, so nothing was charged. You can try again.",
  timeout: 'The AI took too long, so nothing was charged. You can try again.',
  provider_error: 'The AI service had a problem, so nothing was charged. You can try again.',
  duplicate_in_flight: 'This request is already being processed.',
  admin_budget_exhausted: "This month's admin generation limit has been reached.",
  admin_spend_cap_reached: "This month's admin spend limit has been reached.",
  unauthorized: 'Please sign in first.',
};
