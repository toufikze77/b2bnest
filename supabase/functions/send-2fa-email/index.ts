import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    // For demo purposes, we'll just log the email. 
    // In production, you would integrate with a real email service like Resend
    console.log(`2FA Email would be sent to: ${email}`);
    console.log(`Code: ${code}`);
    console.log(`Type: ${type}`);
    
    const subject = type === 'verification' 
      ? 'Verify your email address' 
      : 'Your login verification code';
      
    const message = type === 'verification'
      ? `Welcome ${name || 'User'}! Your verification code is: ${code}`
      : `Your login verification code is: ${code}. This code will expire in 10 minutes.`;

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return new Response(JSON.stringify({
      success: true,
      message: `Email would be sent to ${email}`,
      code: code // For demo purposes only - never return codes in production
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