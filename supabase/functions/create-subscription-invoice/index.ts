import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for logging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role key to bypass RLS for invoice creation
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Require authenticated caller
    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.replace('Bearer ', '');
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerData, error: callerErr } = await supabaseService.auth.getUser(accessToken);
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerEmail = (callerData.user.email || '').toLowerCase();

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error("Session ID is required");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Get checkout session details
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Retrieved Stripe session", { sessionId, status: session.payment_status });

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Get customer details
    const customer = await stripe.customers.retrieve(session.customer as string);
    if (!customer || customer.deleted) {
      throw new Error("Customer not found");
    }

    logStep("Retrieved customer", { customerId: customer.id, email: customer.email });

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const lineItem = subscription.items.data[0];
    const price = lineItem.price;

    logStep("Retrieved subscription", { subscriptionId: subscription.id, amount: price.unit_amount });

    // Confirm requesting user matches the Stripe customer
    if (!customer.email || (customer.email || '').toLowerCase() !== callerEmail) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller is already verified and matches the Stripe customer email
    const user = callerData.user;
    logStep("Found user", { userId: user.id });

    // The official invoice is the one Stripe issues on behalf of B2BNEST (shown in the
    // customer portal, branded via Stripe settings). For the customer's own books we record
    // this purchase as an EXPENSE (money they paid to B2BNEST) — never as a sales invoice.
    const sessionTag = `ref:${sessionId}`;
    const { data: existing } = await supabaseService
      .from('expenses')
      .select('id, amount, description')
      .eq('user_id', user.id)
      .ilike('description', `%${sessionTag}%`)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, expense: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const resolved = planFromLookupKey(price.lookup_key) ??
      planFromAmount(price.unit_amount || 0, price.recurring?.interval);
    const planName = resolved
      ? `${resolved.plan.name} (${resolved.interval === "year" ? "Annual" : "Monthly"})`
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

    const { data: expense, error: expenseError } = await supabaseService
      .from('expenses')
      .insert({
        user_id: user.id,
        category: 'Software subscription',
        description: `B2BNEST ${planName}${stripeInvoiceNumber ? ` · Invoice ${stripeInvoiceNumber}` : ''} (${price.currency.toUpperCase()}) ${sessionTag}`,
        amount: paidTotal,
        date: new Date().toISOString().split('T')[0],
        receipt_url: stripeInvoiceUrl,
        status: 'paid',
      })
      .select()
      .single();

    if (expenseError) {
      logStep("Error recording expense", expenseError);
      throw new Error(`Failed to record expense: ${expenseError.message}`);
    }

    logStep("Expense recorded", { expenseId: expense.id });

    return new Response(JSON.stringify({ success: true, expense }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});