import { serve as stdServe } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsFor, preflight } from "../_shared/cors.ts"; // HMRC P7d: CORS narrowed to the allowed origins
import { guardedServe } from '../_shared/demo-guard.ts';
// Demo read-only: a demo person is refused (403) before the handler runs (docs/demo-readonly).
const serve = guardedServe(stdServe, { headersFor: (req) => corsFor(req) });
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { startCheckout } from "./handler.ts";

const jsonWith = (cors: Record<string, string>) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const logStep = (step: string, details?: unknown) =>
  console.log(`[SUBSCRIPTION-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const json = jsonWith(corsFor(req));
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: "Unauthorized" }, 401);
    const user = { id: userData.user.id, email: userData.user.email };
    const payload = await req.json().catch(() => ({}));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Billing is not configured" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const r = await startCheckout(user, payload, req.headers.get("origin") || "https://www.b2bnest.online", {
      stripe,
      log: logStep,
      isActiveMember: async (orgId, userId) => {
        const { data } = await supabase.from("organization_members").select("id")
          .eq("organization_id", orgId).eq("user_id", userId).eq("is_active", true).maybeSingle();
        return !!data;
      },
      storedCustomerId: async (userId) => {
        const { data } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
    });
    return json(r.body, r.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ error: message }, 500);
  }
});
