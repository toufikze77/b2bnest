import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = userData.user;
    const customerEmail = user.email ?? '';

    const { amount, currency = "gbp", itemName, buyerInfo } = await req.json();

    // Validate inputs
    const allowedCurrencies = new Set(['gbp', 'usd', 'eur']);
    const normalizedCurrency = typeof currency === 'string' ? currency.toLowerCase() : 'gbp';
    if (!allowedCurrencies.has(normalizedCurrency)) {
      return new Response(JSON.stringify({ error: 'Invalid currency' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 50 || numericAmount > 10_000_000) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const safeItemName = typeof itemName === 'string' && itemName.trim().length > 0
      ? itemName.slice(0, 200)
      : 'Purchase';

    // Service client for database writes
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    console.log("Creating Stripe payment for amount:", numericAmount, normalizedCurrency);

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Check if a Stripe customer record exists for this email
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create a one-time payment session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: normalizedCurrency,
            product_data: {
              name: safeItemName
            },
            unit_amount: numericAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/pricing`,
    });

    console.log("Stripe payment session created:", session.id);

    // Store payment record in database using secure function
    try {
      const { data: paymentId, error: paymentError } = await supabaseService
        .rpc('create_payment_record', {
          p_stripe_session_id: session.id,
          p_customer_email: customerEmail,
          p_amount: numericAmount,
          p_item_name: safeItemName,
          p_user_id: user.id,
          p_customer_name: buyerInfo?.fullName || null,
          p_company_name: buyerInfo?.companyName || null,
          p_contact_number: buyerInfo?.contactNumber || null,
          p_currency: normalizedCurrency,
          p_metadata: {
            session_created_at: new Date().toISOString(),
            origin: req.headers.get("origin"),
            stripe_customer_id: customerId || null
          }
        });

      if (paymentError) {
        console.error("Error storing payment record:", paymentError);
        // Continue anyway - don't fail the payment creation
      } else {
        console.log("Payment record stored with ID:", paymentId);
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Continue anyway - don't fail the payment creation
    }

    return new Response(JSON.stringify({
      id: session.id,
      url: session.url,
      status: session.status,
      amount: numericAmount,
      currency: normalizedCurrency
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating Stripe payment:", error);
    return new Response(JSON.stringify({
      error: error.message || "Failed to create payment session"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});