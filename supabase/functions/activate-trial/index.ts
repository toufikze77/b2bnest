// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Admin client for DB ops
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Resolve user from token
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid user auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_trial_active, trial_ends_at, trial_expired")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("activate-trial: profileError", profileError);
      return new Response(JSON.stringify({ error: "Profile fetch failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const existingEnds = profile?.trial_ends_at ? new Date(profile.trial_ends_at as any) : null;
    const active = profile?.is_trial_active && existingEnds && existingEnds > now;

    if (active) {
      return new Response(
        JSON.stringify({ status: "already_active", trial_ends_at: existingEnds?.toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // One-time guard: if explicitly marked expired, we can still allow re-activation if business rules permit
    // For now, allow activation if not currently active
    const endsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_trial_active: true,
        trial_ends_at: endsAt.toISOString(),
        trial_expired: false,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("activate-trial: updateError", updateError);
      return new Response(JSON.stringify({ error: "Could not activate trial" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ status: "activated", trial_ends_at: endsAt.toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("activate-trial: unexpected error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
