// Phase 35: what every credit-spending Edge Function shares for the AI credit ledger (docs/phase35/proposal.sql).
//
// - One request id per request, passed to check_and_deduct_ai_credit (the 'reserve' row), refund_ai_credit (the
//   'refund' row; idempotent per user + request id, so a retry can never refund twice) and record_ai_usage (the
//   'usage' row with tokens and our cost).
// - Usage recording is best effort: a failure or a slow database never changes the answer, the credit or (beyond
//   USAGE_TIMEOUT_MS) the response time. Logs hold counts and codes only, never prompts, answers or documents.

export type AiFeature = "ai_assistant" | "legal_document" | "template";

/** Ties the reserve, the refund and the usage row of one request together. */
export interface LedgerRef { feature: AiFeature; requestId: string }

export interface UsageRow {
  userId: string; requestId: string; feature: AiFeature; docType: string | null;
  model: string; promptTokens: number; completionTokens: number;
}

export interface Usage { promptTokens: number; completionTokens: number }

/** The most a usage write may add to a response. */
export const USAGE_TIMEOUT_MS = 1500;
/** How many times a refund is tried (same request id, so the database refunds at most once). */
export const REFUND_ATTEMPTS = 2;

export const newRequestId = () => crypto.randomUUID();

const tokens = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2_000_000 ? v : null);

/** usage.prompt_tokens / usage.completion_tokens of an OpenAI chat completion, or null if missing or not sane. */
export function readUsage(body: unknown): Usage | null {
  const u = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null)?.usage;
  const promptTokens = tokens(u?.prompt_tokens), completionTokens = tokens(u?.completion_tokens);
  return promptTokens === null || completionTokens === null ? null : { promptTokens, completionTokens };
}

export type LedgerLog = (message: string, meta: Record<string, unknown>) => void;

/** Waits at most USAGE_TIMEOUT_MS; never throws. */
export async function recordUsageBestEffort(
  record: ((row: UsageRow) => Promise<unknown>) | undefined, row: UsageRow, log: LedgerLog, timeoutMs = USAGE_TIMEOUT_MS,
): Promise<void> {
  if (!record) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); });
  try {
    const outcome = await Promise.race([record(row).then(() => "ok" as const), timeout]);
    if (outcome === "timeout") log("usage not recorded in time", { feature: row.feature, reason: "timeout" });
  } catch (e) {
    log("usage not recorded", { feature: row.feature, reason: e instanceof Error ? e.message.slice(0, 60) : "error" });
  } finally {
    clearTimeout(timer);
  }
}

/** Calls the refund up to REFUND_ATTEMPTS times when it throws (network, 5xx). Same request id each time. */
export async function refundWithRetry<T>(refund: () => Promise<T>, attempts = REFUND_ATTEMPTS): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await refund(); } catch (e) { last = e; }
  }
  throw last;
}

/** The three RPCs, as the Edge Functions call them with the service-role client. */
export interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

/** What check_and_deduct_ai_credit answers (shape unchanged by Phase 35). */
export interface CreditResult {
  success: boolean; credits_remaining?: number; credits_limit?: number; reset_date?: string; subscription_tier?: string; error?: string;
}

export function ledgerRpcs(admin: RpcClient) {
  return {
    deduct: async (userId: string, credits: number, ref: LedgerRef) => {
      const { data, error } = await admin.rpc("check_and_deduct_ai_credit", {
        p_user_id: userId, p_credits_to_deduct: credits, p_feature: ref.feature, p_request_id: ref.requestId,
      });
      return { data: data as CreditResult | null, error };
    },
    /** Throws if the credits couldn't be given back (the caller says "contact us"). */
    refund: async (userId: string, credits: number, ref: LedgerRef) => {
      const { data, error } = await admin.rpc("refund_ai_credit", {
        p_user_id: userId, p_credits: credits, p_feature: ref.feature, p_request_id: ref.requestId,
      });
      const d = data as { success?: boolean; error?: string; credits_remaining?: number; refunded?: number } | null;
      if (error || !d?.success) throw new Error(error?.code ?? d?.error ?? "refund_failed");
      return d;
    },
    recordUsage: async (row: UsageRow) => {
      const { error } = await admin.rpc("record_ai_usage", {
        p_user_id: row.userId, p_request_id: row.requestId, p_feature: row.feature, p_doc_type: row.docType,
        p_model: row.model, p_prompt_tokens: row.promptTokens, p_completion_tokens: row.completionTokens,
      });
      if (error) throw new Error(error.code ?? "record_failed");
    },
  };
}
