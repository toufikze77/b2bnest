import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Function called with method:", req.method);

  try {
    const body = await req.text();
    console.log("Raw request body:", body);
    
    const { email, organization_id, role, invited_by }: InvitationRequest = JSON.parse(body);
    console.log("Parsed request:", { email, organization_id, role, invited_by });

    if (!email || !organization_id || !role) {
      throw new Error("Missing required fields: email, organization_id, or role");
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    const inviteUrl = `${req.headers.get('origin') || 'https://b2bnest.online'}/auth?invited=true&org=${organization_id}`;
    console.log("Invite URL:", inviteUrl);

    const emailHtml = `
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
    `;

    console.log("Sending invitation email via Gmail SMTP to:", email);

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: [email],
      subject: "You're invited to join B2BNest!",
      html: emailHtml,
    });

    await client.close();

    console.log("Invitation email sent successfully via Gmail SMTP");

    return new Response(
      JSON.stringify({ success: true, message: "Invitation email sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.stack }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
