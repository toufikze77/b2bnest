// Records a completed subscription checkout as an EXPENSE in the customer's own books (money they paid to B2BNEST),
// never as a sales invoice. The official invoice is the one Stripe issues. Dependencies are injected for tests.
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

// deno-lint-ignore no-explicit-any
type StripeLike = any;
export interface InvoiceDeps {
  stripe: StripeLike;
  storedCustomerId: (userId: string) => Promise<string | null>;
  findExpense: (userId: string, tag: string) => Promise<Record<string, unknown> | null>;
  insertExpense: (row: Record<string, unknown>) => Promise<Record<string, unknown>>;
  log?: (step: string, details?: unknown) => void;
}
export type Result = { status: number; body: Record<string, unknown> };

export async function recordSubscriptionPurchase(user: { id: string; email: string }, sessionId: unknown, deps: InvoiceDeps): Promise<Result> {
  const log = deps.log ?? (() => {});
  const { stripe } = deps;
  if (!sessionId || typeof sessionId !== "string") return { status: 500, body: { error: "Session ID is required" } };
  const callerEmail = (user.email || "").toLowerCase();

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  log("Retrieved Stripe session", { status: session.payment_status });
  if (session.payment_status !== "paid") return { status: 500, body: { error: "Payment not completed" } };

  const customer = await stripe.customers.retrieve(session.customer as string);
  if (!customer || customer.deleted) return { status: 500, body: { error: "Customer not found" } };
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const price = subscription.items.data[0].price;

  // Confirm requesting user matches the Stripe customer
  if (!customer.email || (customer.email || "").toLowerCase() !== callerEmail) return { status: 403, body: { error: "Forbidden" } };

  const sessionTag = `ref:${sessionId}`;
  const existing = await deps.findExpense(user.id, sessionTag);
  if (existing) return { status: 200, body: { success: true, expense: existing } };

  const resolved = planFromLookupKey(price.lookup_key) ?? planFromAmount(price.unit_amount || 0, price.recurring?.interval);
  const planName = resolved
    ? `${resolved.plan.name} (${resolved.interval === "year" ? "Annual" : "Monthly"}${resolved.legacy ? ", earlier price" : ""})`
    : "Subscription Plan";
  // Amount actually paid (Stripe total, already inclusive of any tax Stripe charged).
  const paidTotal = (session.amount_total ?? price.unit_amount ?? 0) / 100;

  let stripeInvoiceNumber: string | null = null;
  let stripeInvoiceUrl: string | null = null;
  if (session.invoice) {
    try {
      const inv = await stripe.invoices.retrieve(session.invoice as string);
      stripeInvoiceNumber = inv.number ?? null;
      stripeInvoiceUrl = inv.hosted_invoice_url ?? inv.invoice_pdf ?? null;
    } catch (_) { /* optional */ }
  }

  const expense = await deps.insertExpense({
    user_id: user.id,
    category: "Software subscription",
    description: `B2BNEST ${planName}${stripeInvoiceNumber ? ` · Invoice ${stripeInvoiceNumber}` : ""} (${String(price.currency).toUpperCase()}) ${sessionTag}`,
    amount: paidTotal,
    date: new Date().toISOString().split("T")[0],
    receipt_url: stripeInvoiceUrl,
    status: "paid",
  });
  log("Expense recorded", { expenseId: expense.id });
  return { status: 200, body: { success: true, expense } };
}
