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

    // Idempotency: one invoice per checkout session
    const { data: existing } = await supabaseService
      .from('invoices')
      .select('id, invoice_number, total_amount, currency')
      .eq('user_id', user.id)
      .ilike('notes', `%${sessionId}%`)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, invoice: {
        id: existing.id, invoice_number: existing.invoice_number,
        amount: existing.total_amount, currency: existing.currency,
      } }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Get user profile for company info
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('full_name, company')
      .eq('id', user.id)
      .single();

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Determine the plan from the Stripe price itself (lookup key first, exact amount as
    // fallback). No amount-range guessing — that is what mislabelled a £350 payment before.
    const amount = price.unit_amount || 0;
    const resolved = planFromLookupKey(price.lookup_key) ??
      planFromAmount(amount, price.recurring?.interval);
    const planName = resolved
      ? `${resolved.plan.name} (${resolved.interval === "year" ? "Annual" : "Monthly"})`
      : "Subscription Plan";

    // Create invoice record
    const invoiceData = {
      user_id: user.id,
      invoice_number: invoiceNumber,
      company_name: "BusinessForms Pro",
      company_address: "123 Business Street, London, UK",
      client_name: profile?.full_name || customer.name || user.email,
      client_email: user.email,
      client_address: customer.address ? `${customer.address.line1}, ${customer.address.city}, ${customer.address.country}` : null,
      items: [{
        description: planName,
        quantity: 1,
        rate: (amount / 100), // Convert from pence to pounds
        amount: (amount / 100)
      }],
      subtotal: (amount / 100),
      tax_rate: 20, // 20% VAT
      tax_amount: (amount / 100) * 0.2,
      total_amount: (amount / 100) * 1.2,
      currency: price.currency.toUpperCase(),
      status: 'paid',
      due_date: new Date().toISOString().split('T')[0], // Today's date
      notes: `Payment processed via Stripe. Subscription ID: ${subscription.id}. Session ID: ${sessionId}.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: invoice, error: invoiceError } = await supabaseService
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      logStep("Error creating invoice", invoiceError);
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created successfully", { invoiceId: invoice.id, invoiceNumber });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: {
        id: invoice.id,
        invoice_number: invoiceNumber,
        amount: invoiceData.total_amount,
        currency: invoiceData.currency
      }
    }), {
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