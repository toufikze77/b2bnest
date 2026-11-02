// Phase 37: starts a Stripe Checkout for an AI credit top-up. Dependencies are injected so tests never touch Stripe or the
// database. This function NEVER grants credits: only stripe-webhook does, after Stripe confirms payment.
//
// Order: flag → pack (catalogue only) → begin_ai_topup_checkout (who may buy, 5,000 cap, one a minute) → the caller's own
// verified Stripe customer → session (mode payment, price from the catalogue, no promotion codes, expires in 31 minutes)
// → attach_ai_topup_session. Any failure after begin closes the checkout (attach NULL), so it stops counting.
import { TOPUP_CAP, TOPUP_SESSION_SECONDS, topupPack } from "../_shared/topup-packs.ts";
import { resolveOrCreateVerifiedCustomer, type StripeLike } from "../_shared/verified-customer.ts";

export type BeginResult =
  | { success: true; checkout_id: string; pack_id: string; credits: number; amount_pence: number; currency: string }
  | { success: false; error: string; state?: string; via?: string | null };

export interface TopupCheckoutDeps {
  stripe: StripeLike;
  /** AI_TOPUPS_ENABLED === "true". */
  enabled: boolean;
  /** public.begin_ai_topup_checkout (service role). */
  begin: (userId: string, packId: string) => Promise<BeginResult>;
  /** public.attach_ai_topup_session (service role). NULL session = Stripe failed; closes the checkout. */
  attach: (checkoutId: string, sessionId: string | null) => Promise<void>;
  /** subscribers.stripe_customer_id for this user, if any. */
  storedCustomerId: (userId: string) => Promise<string | null>;
  now?: () => number;
  log?: (step: string, details?: unknown) => void;
}
export type Result = { status: number; body: Record<string, unknown> };

export const TOPUPS_UNAVAILABLE = "Top-ups aren't available yet.";
export const CHOOSE_PLAN_FIRST = "Choose a plan first. Top-ups are for subscribers.";
export const RATE_LIMITED = "Please wait a minute before starting another top-up.";
export const CAP_REACHED = `You can hold up to ${TOPUP_CAP.toLocaleString("en-GB")} top-up credits at a time.`;

const ALLOWED_ORIGINS = ["https://www.b2bnest.online", "https://b2bnest.online"];
/** Where Stripe sends the customer back. Only our own sites (and local development); anything else gets the main site. */
export function returnOrigin(origin: string | null): string {
  if (origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d{1,5})?$/.test(origin))) return origin;
  return ALLOWED_ORIGINS[0];
}

export async function startTopupCheckout(user: { id: string; email: string }, payload: Record<string, unknown> | null, origin: string | null, deps: TopupCheckoutDeps): Promise<Result> {
  const log = deps.log ?? (() => {});
  if (!deps.enabled) return { status: 503, body: { error: "topups_disabled", message: TOPUPS_UNAVAILABLE } };

  // Only the pack id is read from the client; credits and price come from the catalogue.
  const pack = topupPack(payload?.packId);
  if (!pack) return { status: 400, body: { error: "unknown_pack", message: "Choose a top-up pack." } };

  const begun = await deps.begin(user.id, pack.id);
  if (!begun.success) {
    log("Top-up refused", { code: begun.error, state: begun.state ?? null });
    switch (begun.error) {
      case "not_subscriber": return { status: 403, body: { error: "not_subscriber", message: CHOOSE_PLAN_FIRST } };
      case "rate_limited": return { status: 429, body: { error: "rate_limited", message: RATE_LIMITED } };
      case "topup_cap_exceeded": return { status: 409, body: { error: "topup_cap_exceeded", message: CAP_REACHED } };
      case "unknown_pack": return { status: 400, body: { error: "unknown_pack", message: "Choose a top-up pack." } };
      default: return { status: 500, body: { error: "topup_unavailable", message: "Couldn't start the top-up. Please try again." } };
    }
  }
  const checkoutId = begun.checkout_id;
  const close = async () => { await deps.attach(checkoutId, null).catch(() => {}); };

  // The database catalogue and this code must agree exactly, or nothing is sold.
  if (begun.credits !== pack.credits || begun.amount_pence !== pack.amountPence || begun.currency !== "gbp") {
    log("Catalogue mismatch", { pack: pack.id });
    await close();
    return { status: 500, body: { error: "catalogue_mismatch", message: "Couldn't start the top-up. Please contact support." } };
  }

  try {
    const resolved = await resolveOrCreateVerifiedCustomer(deps.stripe, user, await deps.storedCustomerId(user.id));
    if (!resolved.ok) {
      log("Billing account not verified", { reason: resolved.body.reason });
      await close();
      return { status: resolved.status, body: resolved.body };
    }

    const base = returnOrigin(origin);
    const metadata = { type: "ai_topup", user_id: user.id, pack_id: pack.id, checkout_id: checkoutId };
    const now = Math.floor((deps.now ?? Date.now)() / 1000);
    const session = await deps.stripe.checkout.sessions.create({
      customer: resolved.customerId,
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: { currency: "gbp", unit_amount: pack.amountPence, product_data: { name: `AI credits: ${pack.credits.toLocaleString("en-GB")}` } },
      }],
      allow_promotion_codes: false,
      expires_at: now + TOPUP_SESSION_SECONDS,
      success_url: `${base}/settings?tab=billing&topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/settings?tab=billing&topup=cancelled`,
      client_reference_id: user.id,
      metadata,
      payment_intent_data: { metadata },
    });
    await deps.attach(checkoutId, session.id);
    log("Top-up checkout created", { sessionId: session.id, pack: pack.id });
    return { status: 200, body: { url: session.url, sessionId: session.id } };
  } catch (e) {
    log("Stripe error", { code: (e as { code?: string })?.code ?? null });
    await close();
    return { status: 502, body: { error: "stripe_error", message: "Couldn't start the top-up. Please try again." } };
  }
}
