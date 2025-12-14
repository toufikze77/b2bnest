import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  from?: string;
  html?: boolean;
  workflowId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Workflow email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, html = false }: EmailRequest = await req.json();

    if (!to || !subject || !body) {
      throw new Error("Missing required fields: to, subject, body");
    }

    const recipients = Array.isArray(to) ? to : [to];
    console.log("Sending email:", { to: recipients, subject });

    // Try Resend first (if configured), fallback to Gmail SMTP
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (resendApiKey) {
      // Use Resend
      const resend = new Resend(resendApiKey);
      
      const emailOptions: any = {
        from: "B2BNest <onboarding@resend.dev>",
        to: recipients,
        subject,
      };

      if (html) {
        emailOptions.html = body;
      } else {
        emailOptions.text = body;
      }

      const emailResponse = await resend.emails.send(emailOptions);
      console.log("Email sent successfully via Resend:", emailResponse);

      return new Response(
        JSON.stringify({
          success: true,
          data: emailResponse,
          message: "Email sent successfully via Resend"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (gmailUser && gmailAppPassword) {
      // Use Gmail SMTP via base64 encoded message
      const boundary = "boundary_" + Date.now();
      const recipientList = recipients.join(", ");
      
      const emailContent = html
        ? `MIME-Version: 1.0\r\nFrom: ${gmailUser}\r\nTo: ${recipientList}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`
        : `From: ${gmailUser}\r\nTo: ${recipientList}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;

      // Encode for Gmail API
      const encodedMessage = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Note: Gmail API requires OAuth token, not app password
      // For SMTP, we need a proper SMTP library that works with Deno
      // For now, log that Gmail SMTP needs additional setup
      console.log("Gmail credentials found but Gmail API requires OAuth setup");
      throw new Error("Gmail SMTP not fully configured. Please use Resend API or configure Gmail OAuth.");
    } else {
      throw new Error("No email provider configured. Please add RESEND_API_KEY or Gmail OAuth credentials.");
    }
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: "Failed to send email"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
