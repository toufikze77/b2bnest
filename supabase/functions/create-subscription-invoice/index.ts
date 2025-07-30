import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { sessionId } = await req.json();
    if (!sessionId) {
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

    // Get user from email
    const { data: userData, error: userError } = await supabaseService.auth.admin.getUserByEmail(customer.email as string);
    if (userError || !userData.user) {
      throw new Error("User not found");
    }

    const user = userData.user;
    logStep("Found user", { userId: user.id, email: user.email });

    // Get user profile for company info
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('full_name, company')
      .eq('id', user.id)
      .single();

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Determine plan name based on amount
    let planName = "Subscription Plan";
    const amount = price.unit_amount || 0;
    if (amount <= 1500) planName = "Starter Plan";
    else if (amount <= 4900) planName = "Professional Plan";
    else if (amount >= 7900) planName = "Enterprise Plan";

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
        price: (amount / 100), // Convert from pence to pounds
        total: (amount / 100)
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