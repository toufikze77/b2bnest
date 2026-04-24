import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
    // Require authenticated caller — workflows run from the authenticated app.
    // Without this, the function is an open SMTP relay.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { to, subject, body, html = false }: EmailRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Validate recipients
    const recipients = (Array.isArray(to) ? to : [to])
      .map((r) => String(r).trim())
      .filter((r) => r.length > 0)
      .slice(0, 50); // hard cap to limit blast radius

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (recipients.length === 0 || !recipients.every((r) => emailRegex.test(r))) {
      return new Response(
        JSON.stringify({ error: "Invalid recipient email address(es)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const safeSubject = String(subject).slice(0, 500);
    const safeBody = String(body).slice(0, 100_000);

    console.log("Sending workflow email:", { recipientCount: recipients.length });

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
      subject: safeSubject,
      content: html ? undefined : safeBody,
      html: html ? safeBody : undefined,
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
