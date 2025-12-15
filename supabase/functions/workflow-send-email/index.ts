import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    // Use Gmail SMTP via denomailer
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
      to: recipients,
      subject: subject,
      content: html ? undefined : body,
      html: html ? body : undefined,
    });

    await client.close();

    console.log("Email sent successfully via Gmail SMTP");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully via Gmail"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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
