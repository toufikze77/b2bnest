import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAccess } from "../_shared/access.ts";
import { makeHandler } from "./handler.ts";

// Phase 30. verify_jwt = true (supabase/config.toml). Not deployed by this change: the owner deploys it after review
// (`node scripts/flatten-function.mjs generate-legal-document` for the flattened files). Needs OPENAI_API_KEY and the
// refund function from docs/phase20 (public.refund_ai_credit).
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

serve(makeHandler({
  openAIKey: Deno.env.get("OPENAI_API_KEY"),
  getUserId: async (token) => {
    const { data: { user } } = await admin.auth.getUser(token);
    return user?.id ?? null;
  },
  // Phase 12: asked as the caller (their JWT), so the database decides.
  checkAccess: (authHeader) =>
    checkAccess(createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } })),
  deduct: async (userId, credits) => {
    const { data, error } = await admin.rpc("check_and_deduct_ai_credit", { p_user_id: userId, p_credits_to_deduct: credits });
    return { data, error };
  },
  refund: async (userId, credits) => {
    const { data, error } = await admin.rpc("refund_ai_credit", { p_user_id: userId, p_credits: credits });
    if (error || !data?.success) throw new Error(error?.code ?? data?.error ?? "refund_failed");
    return data;
  },
  openai: (body, signal) => fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }),
}));
