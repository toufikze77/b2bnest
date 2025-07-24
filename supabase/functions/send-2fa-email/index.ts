import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Email2FARequest {
  email: string;
  code: string;
  type: 'verification' | 'login';
  name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, type, name }: Email2FARequest = await req.json();

    // Initialize Supabase client for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limiting
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
          retryAfter: 15 * 60 // 15 minutes in seconds
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = type === 'verification' 
      ? 'Verify your email address' 
      : 'Your login verification code';
      
    const emailContent = type === 'verification'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to BusinessForms Pro!</h1>
          <p>Hello ${name || 'User'},</p>
          <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #2563eb; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h2>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
          <p>Best regards,<br>The BusinessForms Pro Team</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Login Verification Code</h1>
          <p>Hello,</p>
          <p>Here's your verification code to complete your login:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #2563eb; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h2>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't try to log in, please ignore this email and consider changing your password.</p>
          <p>Best regards,<br>The BusinessForms Pro Team</p>
        </div>
      `;

    // Log securely without exposing sensitive data
    console.log(`Sending 2FA email to: ${email.substring(0, 3)}***@${email.split('@')[1]}`);
    console.log(`Type: ${type}`);

    const emailResponse = await resend.emails.send({
      from: "BusinessForms Pro <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: emailContent,
    });

    console.log("Email sent successfully");

    return new Response(JSON.stringify({
      success: true,
      message: `2FA code sent successfully`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-2fa-email function:", error);
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