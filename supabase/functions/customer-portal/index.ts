import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolvePortalConfiguration } from "../_shared/portal-config.ts";
import { resolveVerifiedCustomer } from "../_shared/verified-customer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Billing is not configured" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Stored id if it exists in this Stripe account; otherwise only a single, ownership-verified email match.
    const resolved = await resolveVerifiedCustomer(stripe, { id: user.id, email: user.email }, (subscriber?.stripe_customer_id as string | null) ?? null);
    if (!resolved.customerId) {
      console.error("[CUSTOMER-PORTAL] no verified customer", resolved.reason);
      return json({ error: "No verified billing account found for this user. Please contact support.", reason: resolved.reason }, 404);
    }
    if (resolved.storedMissing) console.error("[CUSTOMER-PORTAL] stored customer missing; using verified email match");

    // Policy configuration: no plan switching in the portal, cancellation at period end without proration.
    const configuration = await resolvePortalConfiguration(stripe);
    const origin = req.headers.get("origin") || "https://www.b2bnest.online";
    const session = await stripe.billingPortal.sessions.create({ customer: resolved.customerId, configuration, return_url: `${origin}/settings` });
    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CUSTOMER-PORTAL] error", message);
    return json({ error: message }, 500);
  }
});
