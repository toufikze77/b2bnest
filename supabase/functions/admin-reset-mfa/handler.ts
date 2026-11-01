// Admin → Users → Reset two-step sign-in (Phase 25). Owner-assisted recovery for someone who lost every phone with their
// authenticator app. Rules, in order:
//   1. a valid token; 2. the caller's session is at aal2 (passed their own code), never a password-only session;
//   3. the caller is a super admin; 4. never their own account; 5. a reason is required; 6. at most RATE_LIMIT resets
//   per caller per hour; 7. the audit row (who, whom, reason, time) is written BEFORE anything is removed, so a reset
//   never happens unrecorded. Then every factor of the user is removed with the Auth admin API.
// Never logs or returns tokens, secrets, emails or the reason text.

export type ResetResult = { status: number; body: Record<string, unknown> };
export type DepError = { code?: string; message?: string } | null;

export interface ResetDeps {
  /** The caller, from their JWT (checked by Supabase Auth); null if the token is not valid. */
  getUser: (token: string) => Promise<{ id: string } | null>;
  isSuperAdmin: (userId: string) => Promise<boolean>;
  /** How many resets this caller made in the last hour (from audit_logs). */
  recentResets: (callerId: string, sinceIso: string) => Promise<number>;
  listFactorIds: (userId: string) => Promise<{ ids: string[]; error: DepError }>;
  deleteFactor: (userId: string, factorId: string) => Promise<{ error: DepError }>;
  /** Inserts one public.audit_logs row (service role). */
  audit: (row: { user_id: string; action: string; resource_type: string; resource_id: string; details: Record<string, unknown> }) => Promise<{ error: DepError }>;
  now?: () => Date;
  log?: (msg: string) => void;
}

export const RATE_LIMIT = 5;
export const AUDIT_ACTION = "two_step_reset_by_admin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `aal` claim of a JWT whose signature Supabase Auth has already checked (getUser). Null if unreadable. */
export function tokenAal(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

export async function resetMfa(token: string, payload: unknown, deps: ResetDeps): Promise<ResetResult> {
  const log = deps.log ?? ((m: string) => console.error(m));
  if (!token) return { status: 401, body: { error: "unauthorized" } };
  const p = (payload ?? {}) as { user_id?: unknown; reason?: unknown };
  const reason = typeof p.reason === "string" ? p.reason.trim() : "";
  if (typeof p.user_id !== "string" || !UUID.test(p.user_id)) {
    return { status: 400, body: { error: "bad_request", message: "Send { user_id: <uuid>, reason: <text> }." } };
  }
  if (reason.length < 5 || reason.length > 500) {
    return { status: 400, body: { error: "reason_required", message: "Say why (5 to 500 characters), for example how you checked it is them." } };
  }
  const userId = p.user_id;

  const caller = await deps.getUser(token);
  if (!caller) return { status: 401, body: { error: "unauthorized" } };
  if (tokenAal(token) !== "aal2") {
    return { status: 403, body: { error: "mfa_required", message: "Enter your own two-step code first (sign in again with your authenticator app)." } };
  }
  if (!(await deps.isSuperAdmin(caller.id))) return { status: 403, body: { error: "not_authorized" } };
  if (caller.id === userId) {
    return { status: 403, body: { error: "own_account", message: "You can't reset your own two-step sign-in. Ask another platform admin." } };
  }
  const now = (deps.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  if ((await deps.recentResets(caller.id, since)) >= RATE_LIMIT) {
    return { status: 429, body: { error: "rate_limited", message: `At most ${RATE_LIMIT} resets an hour. Try again later.` } };
  }

  const listed = await deps.listFactorIds(userId);
  if (listed.error) {
    log(`admin-reset-mfa: list failed (${listed.error.code ?? "no code"})`);
    return { status: 502, body: { error: "list_failed" } };
  }
  const audit = await deps.audit({
    user_id: userId, action: AUDIT_ACTION, resource_type: "user", resource_id: userId,
    details: { admin_id: caller.id, reason, factors: listed.ids.length, at: now.toISOString() },
  });
  if (audit.error) {
    log(`admin-reset-mfa: audit failed (${audit.error.code ?? "no code"}); nothing removed`);
    return { status: 500, body: { error: "audit_failed", message: "Nothing was changed because the reset could not be recorded." } };
  }
  let removed = 0;
  for (const id of listed.ids) {
    const r = await deps.deleteFactor(userId, id);
    if (r.error) {
      log(`admin-reset-mfa: delete failed after ${removed} (${r.error.code ?? "no code"})`);
      return { status: 502, body: { error: "delete_failed", removed, message: "Some apps could not be removed. Try again." } };
    }
    removed++;
  }
  return { status: 200, body: { ok: true, user_id: userId, removed } };
}
