import { serve as stdServe } from "https://deno.land/std@0.190.0/http/server.ts";
import { narrowServe } from '../_shared/cors.ts';
// Edge Functions CORS batch A (docs/hmrc-p7d/README.md): answers carry the narrowed CORS headers (corsFor), never '*'.
const serve = narrowServe(stdServe);
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { maskEmail, sendCodeEmail } from './send.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Email2FARequest {
  email: string;
  type: 'verification' | 'login';
  name?: string;
}

// Cryptographically secure 6-digit code
function generateSecureCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String((buf[0] % 900000) + 100000);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller to prevent abuse/phishing spam
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const callerUserId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();

    const { email, type, name }: Email2FARequest = await req.json();

    if (!email || !type || (type !== 'verification' && type !== 'login')) {
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Callers can only request codes for their own email
    if (!callerEmail || callerEmail !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting
    const { data: canSend, error: rateLimitError } = await supabase
      .rpc('check_2fa_rate_limit', { p_email: email });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!canSend) {
      return new Response(
        JSON.stringify({
          error: 'Too many 2FA requests. Please wait before requesting another code.',
          retryAfter: 15 * 60,
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate code server-side with CSPRNG and persist via service role
    const code = generateSecureCode();
    const { error: insertError } = await supabase
      .from('user_2fa_codes')
      .insert({
        user_id: callerUserId,
        code,
        code_type: type,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error('Error storing 2FA code:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending 2FA email to: ${maskEmail(email)} type=${type}`);

    // The sender, the email and Resend's answer: send.ts (a Resend refusal answers 502, never { success: true }).
    return await sendCodeEmail(resend, { email, type, code, name }, corsHeaders);
  } catch (error: any) {
    console.error("Error in send-2fa-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
