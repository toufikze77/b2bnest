// Admin → Users → Suspend / Reactivate (Phase 12c). Keeps two things in step:
//   1. profiles.is_active, changed ONLY through public.admin_set_user_status called AS THE CALLER (their JWT), so the
//      database checks super admin, own account, admin/owner role and master account, and writes the audit row;
//   2. the Supabase Auth ban (service role), so a suspended person can't sign in or refresh a session.
// Suspend: flag first, then ban; if the ban fails, the flag is put back. Reactivate: unban first, then flag; if the
// flag fails, the ban is put back. No retries. Never logs tokens or emails.

export type RpcError = { code?: string; message?: string } | null;

export interface BanDeps {
  /** The caller, from their JWT; null if the token is not valid. */
  getUser: (token: string) => Promise<{ id: string } | null>;
  /** public.admin_set_user_status(_user_id, _active), called with the CALLER's JWT. */
  setStatus: (token: string, userId: string, active: boolean) => Promise<{ error: RpcError }>;
  /** Supabase Auth ban on (true) or off (false), service role. */
  setBan: (userId: string, banned: boolean) => Promise<{ error: RpcError }>;
  log?: (msg: string) => void;
}

export type BanResult = { status: number; body: Record<string, unknown> };

export const BAN_DURATION = "876000h"; // 100 years: Supabase Auth has no "forever"; 'none' lifts it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map a refusal from admin_set_user_status to an HTTP status and a stable error code the app turns into words. */
export function mapStatusError(e: RpcError): BanResult {
  const msg = e?.message ?? "";
  const known = /^(cannot_suspend_super_admin|cannot_suspend_admin|cannot_suspend_master)\b/.exec(msg)?.[1];
  if (known) return { status: 409, body: { error: known } };
  if (/own status/i.test(msg)) return { status: 403, body: { error: "own_account" } };
  if (e?.code === "42501" || /not authorized/i.test(msg)) return { status: 403, body: { error: "not_authorized" } };
  if (e?.code === "P0002" || /no such user/i.test(msg)) return { status: 404, body: { error: "no_such_user" } };
  return { status: 502, body: { error: "status_failed" } };
}

export async function setUserBan(token: string, payload: unknown, deps: BanDeps): Promise<BanResult> {
  const log = deps.log ?? ((m: string) => console.error(m));
  if (!token) return { status: 401, body: { error: "unauthorized" } };
  const p = (payload ?? {}) as { user_id?: unknown; suspend?: unknown };
  if (typeof p.user_id !== "string" || !UUID.test(p.user_id) || typeof p.suspend !== "boolean") {
    return { status: 400, body: { error: "bad_request", message: "Send { user_id: <uuid>, suspend: true | false }." } };
  }
  const userId = p.user_id;
  const caller = await deps.getUser(token);
  if (!caller) return { status: 401, body: { error: "unauthorized" } };

  if (p.suspend) {
    const flag = await deps.setStatus(token, userId, false);
    if (flag.error) return mapStatusError(flag.error);
    const ban = await deps.setBan(userId, true);
    if (ban.error) {
      log(`admin-set-user-ban: ban failed (${ban.error.code ?? "no code"}); putting the flag back`);
      const revert = await deps.setStatus(token, userId, true);
      if (revert.error) {
        log(`admin-set-user-ban: revert failed (${revert.error.code ?? "no code"})`);
        return { status: 500, body: { error: "ban_failed_flag_kept", message: "The account is marked suspended in B2BNEST but sign-in could not be blocked. Try again, or reactivate it." } };
      }
      return { status: 502, body: { error: "ban_failed", message: "Sign-in could not be blocked, so nothing was changed. Please try again." } };
    }
    return { status: 200, body: { ok: true, user_id: userId, suspended: true } };
  }

  const unban = await deps.setBan(userId, false);
  if (unban.error) {
    log(`admin-set-user-ban: unban failed (${unban.error.code ?? "no code"})`);
    return { status: 502, body: { error: "unban_failed", message: "Sign-in could not be unblocked, so nothing was changed. Please try again." } };
  }
  const flag = await deps.setStatus(token, userId, true);
  if (flag.error) {
    const reban = await deps.setBan(userId, true);
    if (reban.error) {
      log(`admin-set-user-ban: re-ban failed (${reban.error.code ?? "no code"})`);
      return { status: 500, body: { error: "unbanned_flag_kept", message: "Sign-in was unblocked but the account is still marked suspended. Try Reactivate again." } };
    }
    return mapStatusError(flag.error);
  }
  return { status: 200, body: { ok: true, user_id: userId, suspended: false } };
}
