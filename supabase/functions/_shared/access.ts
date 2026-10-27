// Server-side access check (Phase 12). Asks public.my_access_state() AS THE CALLER (a client built with the user's
// JWT, never the service role), so the database decides: owner / subscribed / trial / trial_ended.
// Call it after authenticating the user and BEFORE deducting AI credits or calling any model.

export type AccessState = "owner" | "subscribed" | "trial" | "trial_ended";

/** The one call this needs (kept narrow so tests can pass a fake client). */
export interface AccessRpcClient {
  rpc: (fn: "my_access_state") => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

export type AccessCheck =
  | { ok: true; state: AccessState | "not_installed" }
  | { ok: false; status: 402 | 503; body: { error: "trial_ended" | "access_check_failed"; message: string; via?: "self" | "company" } };

export const TRIAL_ENDED_MESSAGE =
  "Your 14-day trial has ended. Choose a plan on the Pricing page to keep using this feature. Nothing has been deleted.";
export const COMPANY_TRIAL_ENDED_MESSAGE =
  "Your company's trial has ended. Ask the account owner to choose a plan to keep using this feature. Nothing has been deleted.";

const isMissingFunction = (e: { code?: string; message?: string }) =>
  e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? "");

export async function checkAccess(client: AccessRpcClient): Promise<AccessCheck> {
  let res: { data: unknown; error: { code?: string; message?: string } | null };
  try {
    res = await client.rpc("my_access_state");
  } catch (e) {
    console.error("access check failed", e);
    return { ok: false, status: 503, body: { error: "access_check_failed", message: "We couldn't check your plan just now. Nothing was charged. Please try again." } };
  }
  if (res.error) {
    // Until docs/phase12/proposal.sql is applied the function does not exist; keep today's behaviour (logged).
    if (isMissingFunction(res.error)) {
      console.warn("my_access_state() not installed yet; access check skipped (docs/phase12/README.md)");
      return { ok: true, state: "not_installed" };
    }
    console.error("access check failed", res.error.code, res.error.message);
    return { ok: false, status: 503, body: { error: "access_check_failed", message: "We couldn't check your plan just now. Nothing was charged. Please try again." } };
  }
  const row = (Array.isArray(res.data) ? res.data[0] : res.data) as { state?: string; via?: string } | null;
  const state = row?.state;
  if (state === "owner" || state === "subscribed" || state === "trial") return { ok: true, state };
  if (state === "trial_ended") {
    const via = row?.via === "company" ? "company" : "self";
    return { ok: false, status: 402, body: { error: "trial_ended", message: via === "company" ? COMPANY_TRIAL_ENDED_MESSAGE : TRIAL_ENDED_MESSAGE, via } };
  }
  console.error("access check returned no usable row");
  return { ok: false, status: 503, body: { error: "access_check_failed", message: "We couldn't check your plan just now. Nothing was charged. Please try again." } };
}
