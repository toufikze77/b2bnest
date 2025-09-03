import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  organization_id: string;
  role: string;
  invited_by: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, organization_id, role, invited_by }: InvitationRequest = await req.json();

    const inviteUrl = `${req.headers.get('origin') || 'https://b2bnest.online'}/auth?invited=true&org=${organization_id}`;

    const emailResponse = await resend.emails.send({
      from: "B2BNest <noreply@b2bnest.online>",
      to: [email],
      subject: "You're invited to join B2BNest!",
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">You're Invited!</h1>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            ${invited_by} has invited you to join their organization on B2BNest as a <strong>${role}</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            B2BNest is a comprehensive business management platform with project management, 
            CRM, document generation, and AI-powered features to help your business grow.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If you can't click the button, copy and paste this URL into your browser:<br>
            <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
          </p>
          
          <hr style="border: none; height: 1px; background-color: #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            This invitation was sent by ${invited_by}. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
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