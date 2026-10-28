import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { recordSubscriptionPurchase } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const logStep = (step: string, details?: unknown) =>
  console.log(`[CREATE-INVOICE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Service role: records the expense for the verified caller only.
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  try {
    const accessToken = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!accessToken) return json({ error: "Unauthorized" }, 401);
    const { data: callerData, error: callerErr } = await supabase.auth.getUser(accessToken);
    if (callerErr || !callerData?.user) return json({ error: "Unauthorized" }, 401);
    const { sessionId } = await req.json().catch(() => ({}));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe secret key not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const r = await recordSubscriptionPurchase({ id: callerData.user.id, email: callerData.user.email ?? "" }, sessionId, {
      stripe,
      log: logStep,
      storedCustomerId: async (userId) => {
        const { data } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
      findExpense: async (userId, tag) => {
        const { data } = await supabase.from("expenses").select("id, amount, description").eq("user_id", userId).ilike("description", `%${tag}%`).maybeSingle();
        return data ?? null;
      },
      insertExpense: async (row) => {
        const { data, error } = await supabase.from("expenses").insert(row).select().single();
        if (error) throw new Error(`Failed to record expense: ${error.message}`);
        return data;
      },
    });
    return json(r.body, r.status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return json({ error: errorMessage }, 500);
  }
});
