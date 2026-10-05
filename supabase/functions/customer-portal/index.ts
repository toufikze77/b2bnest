import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolvePortalConfiguration } from "../_shared/portal-config.ts";

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

    // Prefer the stored customer id; fall back to an email lookup.
    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = subscriber?.stripe_customer_id as string | null;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    }
    if (!customerId) return json({ error: "No billing account found for this user" }, 404);

    // Policy configuration: no plan switching in the portal, cancellation at period end without proration.
    const configuration = await resolvePortalConfiguration(stripe);
    const origin = req.headers.get("origin") || "https://www.b2bnest.online";
    const createSession = (customer: string) =>
      stripe.billingPortal.sessions.create({ customer, configuration, return_url: `${origin}/settings` });

    try {
      const session = await createSession(customerId);
      return json({ url: session.url });
    } catch (err) {
      // The stored id may not exist in this Stripe account/mode. Look the customer up by email in the
      // account the live key belongs to; never write it back here (no record changes in the portal path).
      // deno-lint-ignore no-explicit-any
      if ((err as any)?.code !== "resource_missing") throw err;
      console.error("[CUSTOMER-PORTAL] stored customer not found in this Stripe account; trying email lookup");
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const fallbackId = customers.data[0]?.id;
      if (!fallbackId || fallbackId === customerId) {
        console.error("[CUSTOMER-PORTAL] no customer for this account in this Stripe mode");
        return json({ error: "No billing account found in live Stripe for this user" }, 404);
      }
      const session = await createSession(fallbackId);
      return json({ url: session.url });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CUSTOMER-PORTAL] error", message);
    return json({ error: message }, 500);
  }
});
