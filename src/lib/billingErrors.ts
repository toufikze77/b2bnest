// Billing errors the server returns as codes, mapped to what the app shows. The server side is
// supabase/functions/_shared/verified-customer.ts (BILLING_LINK_ERROR_CODE / BILLING_LINK_ERROR).

/** A Stripe customer exists for this email but can't be proven to be this user's (Phase 14). Nothing was charged. */
export const BILLING_LINK_ERROR_CODE = 'billing_account_unverified';
export const BILLING_LINK_ERROR = "We couldn't link your billing account. Please contact support.";

/** True when an Edge Function error body (raw text or parsed) is the billing-link error. */
export function isBillingLinkError(body: string | { error?: unknown } | null | undefined): boolean {
  if (!body) return false;
  if (typeof body === 'string') return body.includes(BILLING_LINK_ERROR_CODE);
  return body.error === BILLING_LINK_ERROR_CODE;
}

/** Reads the JSON body of a supabase.functions.invoke error, if any. */
export async function readFunctionError(error: unknown): Promise<{ error?: string; message?: string; reason?: string } | null> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string; reason?: string }> } })?.context;
  return ctx?.json ? await ctx.json().catch(() => null) : null;
}

/** The HTTP status of a supabase.functions.invoke error (null when nothing reached the server). */
export const functionErrorStatus = (error: unknown): number | null =>
  (error as { context?: { status?: number } })?.context?.status ?? null;

/**
 * Phase 26: the function's own words for a failed call, never the client's "Edge Function returned a non-2xx status
 * code" and never a stack trace. Uses `message`, else `error` when it is a sentence (codes such as "no_subscription"
 * are not shown), else the fallback. Only the first line, at most 300 characters.
 */
export function functionErrorText(body: { error?: unknown; message?: unknown } | null | undefined, fallback: string): string {
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const sentence = (v: string | null) => (v && /\s/.test(v) && !/non-2xx/i.test(v) ? v : null);
  const text = sentence(pick(body?.message)) ?? sentence(pick(body?.error));
  if (!text) return fallback;
  const line = text.split('\n')[0].trim();
  return line.length > 300 ? `${line.slice(0, 297)}…` : line;
}

/** customer-portal answered 404 with reason "no_customer": this account has never had a Stripe customer. */
export const NO_BILLING_ACCOUNT = "You don't have a billing account yet. Choose a plan first.";
export const isNoCustomer = (status: number | null, body: { reason?: unknown } | null | undefined) =>
  status === 404 && body?.reason === 'no_customer';
