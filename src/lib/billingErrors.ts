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
export async function readFunctionError(error: unknown): Promise<{ error?: string; message?: string } | null> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string }> } })?.context;
  return ctx?.json ? await ctx.json().catch(() => null) : null;
}
