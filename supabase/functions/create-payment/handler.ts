// One-off template purchase (Template Center → CheckoutModal → StripeCheckout). Dependencies are injected for tests.
// deno-lint-ignore no-explicit-any
type StripeLike = any;
export interface PaymentDeps {
  stripe: StripeLike;
  storedCustomerId: (userId: string) => Promise<string | null>;
  /** public.create_payment_record (best effort: a failure never blocks the payment). */
  recordPayment: (args: Record<string, unknown>) => Promise<void>;
  log?: (step: string, details?: unknown) => void;
}
export type Result = { status: number; body: Record<string, unknown> };

const ALLOWED_CURRENCIES = new Set(["gbp", "usd", "eur"]);

export async function createPayment(user: { id: string; email: string }, payload: Record<string, unknown> | null, origin: string | null, deps: PaymentDeps): Promise<Result> {
  const log = deps.log ?? (() => {});
  const { stripe } = deps;
  const { amount, currency = "gbp", itemName, buyerInfo } = (payload ?? {}) as {
    amount?: unknown; currency?: unknown; itemName?: unknown; buyerInfo?: { fullName?: string; companyName?: string; contactNumber?: string };
  };
  const normalizedCurrency = typeof currency === "string" ? currency.toLowerCase() : "gbp";
  if (!ALLOWED_CURRENCIES.has(normalizedCurrency)) return { status: 400, body: { error: "Invalid currency" } };
  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount < 50 || numericAmount > 10_000_000) return { status: 400, body: { error: "Invalid amount" } };
  const safeItemName = typeof itemName === "string" && itemName.trim().length > 0 ? itemName.slice(0, 200) : "Purchase";
  const customerEmail = user.email ?? "";

  // Check if a Stripe customer record exists for this email
  const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
  let customerId: string | undefined;
  if (customers.data.length > 0) customerId = customers.data[0].id;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [{ price_data: { currency: normalizedCurrency, product_data: { name: safeItemName }, unit_amount: numericAmount }, quantity: 1 }],
    mode: "payment",
    success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
  });
  log("Stripe payment session created", { sessionId: session.id });

  try {
    await deps.recordPayment({
      p_stripe_session_id: session.id, p_customer_email: customerEmail, p_amount: numericAmount, p_item_name: safeItemName,
      p_user_id: user.id, p_customer_name: buyerInfo?.fullName || null, p_company_name: buyerInfo?.companyName || null,
      p_contact_number: buyerInfo?.contactNumber || null, p_currency: normalizedCurrency,
      p_metadata: { session_created_at: new Date().toISOString(), origin, stripe_customer_id: customerId || null },
    });
  } catch (e) {
    log("Error storing payment record", { error: (e as Error).message }); // continue: never fail the payment for this
  }
  return { status: 200, body: { id: session.id, url: session.url, status: session.status, amount: numericAmount, currency: normalizedCurrency } };
}
