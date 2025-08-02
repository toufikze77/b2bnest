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
    const { amount, currency = "gbp", itemName, isAuthenticated = false, buyerInfo } = await req.json();

    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Create service client for database writes
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let user = null;
    let customerEmail = "guest@example.com"; // Default for guest users

    // Try to get authenticated user if they claim to be authenticated
    if (isAuthenticated) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
        if (user?.email) {
          customerEmail = user.email;
        }
      }
    }

    // Use buyer info email if available and no authenticated user
    if (!user && buyerInfo?.email) {
      customerEmail = buyerInfo.email;
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    console.log("Creating Stripe payment for amount:", amount, currency);

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
            currency: currency,
            product_data: { 
              name: itemName 
            },
            unit_amount: amount, // Amount should already be in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/pricing`,
    });

    console.log("Stripe payment session created:", session.id);

    // Store payment record in database
    try {
      const { data: paymentRecord, error: paymentError } = await supabaseService
        .from("payments")
        .insert({
          stripe_session_id: session.id,
          user_id: user?.id || null,
          customer_email: customerEmail,
          customer_name: buyerInfo?.fullName || null,
          company_name: buyerInfo?.companyName || null,
          contact_number: buyerInfo?.contactNumber || null,
          amount: amount,
          currency: currency,
          status: "pending",
          item_name: itemName,
          stripe_customer_id: customerId || null,
          metadata: {
            session_created_at: new Date().toISOString(),
            origin: req.headers.get("origin")
          }
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error storing payment record:", paymentError);
        // Continue anyway - don't fail the payment creation
      } else {
        console.log("Payment record stored:", paymentRecord.id);
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Continue anyway - don't fail the payment creation
    }

    return new Response(JSON.stringify({
      id: session.id,
      url: session.url,
      status: session.status,
      amount: amount,
      currency: currency
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