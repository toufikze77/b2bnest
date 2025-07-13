import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Send2FARequest {
  email: string;
  codeType: 'login' | 'password_reset' | 'setup_2fa';
  userId?: string;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, codeType, userId }: Send2FARequest = await req.json();
    
    // Generate 6-digit code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store code in database
    if (userId) {
      const { error: codeError } = await supabase
        .from('user_2fa_codes')
        .insert({
          user_id: userId,
          code,
          code_type: codeType,
          expires_at: expiresAt.toISOString()
        });

      if (codeError) {
        console.error('Error storing 2FA code:', codeError);
        throw new Error('Failed to store verification code');
      }
    }

    // Send email with code
    const subject = codeType === 'login' ? 'Your Login Verification Code' 
                  : codeType === 'password_reset' ? 'Password Reset Verification Code'
                  : 'Setup 2FA Verification Code';

    const emailResponse = await resend.emails.send({
      from: "BusinessForms Pro <noreply@resend.dev>",
      to: [email],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Verification Code</h2>
          <p style="color: #666; font-size: 16px;">Your verification code is:</p>
          <div style="background: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">BusinessForms Pro - Secure Business Solutions</p>
        </div>
      `,
    });

    console.log("2FA code email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, codeId: emailResponse.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-2fa-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);