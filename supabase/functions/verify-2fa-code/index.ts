import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email?: string;
  user_id?: string;
  code: string;
  code_type: "verification" | "login" | "setup_2fa";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: VerifyRequest = await req.json();
    const { email, user_id, code, code_type } = body;

    if (!code || !code_type || (!email && !user_id) || !/^[0-9]{4,8}$/.test(code)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve target user_id (use given user_id, or look up by email)
    let targetUserId = user_id;
    if (!targetUserId && email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      targetUserId = profile?.id;
    }

    let query = supabase
      .from("user_2fa_codes")
      .select("id, user_id, code_type, expires_at, used")
      .eq("code", code)
      .eq("code_type", code_type)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString());

    if (targetUserId) query = query.eq("user_id", targetUserId);

    const { data: row, error } = await query.maybeSingle();

    if (error || !row) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired verification code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("user_2fa_codes").update({ used: true }).eq("id", row.id);

    return new Response(JSON.stringify({ success: true, user_id: row.user_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
