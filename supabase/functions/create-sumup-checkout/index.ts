import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { amount, currency = "GBP", itemName, returnUrl } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      console.log("User authenticated:", data.user?.email);
    }

    const sumupApiKey = Deno.env.get("SUMUP_API_KEY");
    if (!sumupApiKey) {
      throw new Error("SumUp API key not configured");
    }

    console.log("Creating SumUp checkout for amount:", amount, currency);

    // Create SumUp checkout with proper return URL
    const checkoutBody = {
      checkout_reference: `checkout_${Date.now()}`,
      amount: parseFloat(amount.toString()),
      currency: currency,
      merchant_code: "MQ3LXRL4",
      description: itemName,
      return_url: returnUrl || `${req.headers.get("origin")}/sumup-payment`,
    };

    console.log("Checkout request body:", JSON.stringify(checkoutBody, null, 2));

    const checkoutResponse = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sumupApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutBody),
    });

    const responseText = await checkoutResponse.text();
    console.log("SumUp API response status:", checkoutResponse.status);
    console.log("SumUp API response:", responseText);

    if (!checkoutResponse.ok) {
      console.error("SumUp API Error:", responseText);
      throw new Error(`SumUp API error: ${checkoutResponse.status} - ${responseText}`);
    }

    const checkoutData = JSON.parse(responseText);
    console.log("SumUp checkout created:", checkoutData.id);

    // Use SumUp's hosted checkout page
    const checkoutUrl = `https://checkout.sumup.com/${checkoutData.id}`;
    
    return new Response(JSON.stringify({
      id: checkoutData.id,
      checkout_url: checkoutUrl,
      status: checkoutData.status,
      amount: checkoutData.amount,
      currency: checkoutData.currency
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating SumUp checkout:", error);
    return new Response(JSON.stringify({
      error: error.message || "Failed to create checkout"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});