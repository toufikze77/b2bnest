import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPayment } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const payload = await req.json().catch(() => ({}));

    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) throw new Error("Stripe secret key not configured");
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const r = await createPayment({ id: userData.user.id, email: userData.user.email ?? "" }, payload, req.headers.get("origin"), {
      stripe,
      log: (step, details) => console.log(`[CREATE-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`),
      storedCustomerId: async (userId) => {
        const { data } = await service.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
      recordPayment: async (args) => {
        const { error } = await service.rpc("create_payment_record", args);
        if (error) throw new Error(error.message);
      },
    });
    return json(r.body, r.status);
  } catch (error) {
    console.error("Error creating Stripe payment:", error instanceof Error ? error.message : String(error));
    return json({ error: (error as Error)?.message || "Failed to create payment session" }, 500);
  }
});
