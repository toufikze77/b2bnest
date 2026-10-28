import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkSubscription } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const logStep = (step: string, details?: unknown) =>
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("Stripe key not configured — reporting free tier");
      return json({ subscribed: false, subscription_tier: "free", billing_interval: null });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const r = await checkSubscription({ id: user.id, email: user.email }, {
      stripe,
      log: logStep,
      storedCustomerId: async (userId) => {
        const { data } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
      upsertSubscriber: async (row) => {
        const { error } = await supabase.from("subscribers").upsert(row, { onConflict: "email" });
        if (error) throw new Error(`subscribers: ${error.message}`);
      },
    });
    return json(r.body, r.status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return json({ error: errorMessage }, 500);
  }
});
