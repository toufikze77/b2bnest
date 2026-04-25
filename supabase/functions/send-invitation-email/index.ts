import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { escapeHtml } from "../_shared/html.ts";

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
    // Require authenticated caller to prevent open-relay abuse
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

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body = await req.json() as InvitationRequest;
    const email = (body.email ?? "").toString().trim().slice(0, 320);
    const organization_id = (body.organization_id ?? "").toString().trim().slice(0, 100);
    const role = (body.role ?? "").toString().trim().slice(0, 50);
    const invited_by = (body.invited_by ?? "").toString().trim().slice(0, 200);

    if (!email || !organization_id || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, organization_id, or role" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Verify the authenticated caller is actually a member of the org they
    // are inviting people to.
    const callerId = user.id;
    const { data: membership, error: memberError } = await supabaseAuth
      .from("organization_members")
      .select("id, role, is_active")
      .eq("organization_id", organization_id)
      .eq("user_id", callerId)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden: not a member of this organization" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    const gmailFrom = Deno.env.get("GMAIL_FROM") || gmailUser;

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    // Safe diagnostics (never log the actual password)
    console.log("SMTP config:", {
      user: gmailUser,
      from: gmailFrom,
      appPasswordLength: gmailAppPassword.length,
    });

    const inviteUrl = `${req.headers.get('origin') || 'https://b2bnest.online'}/auth?invited=true&org=${encodeURIComponent(organization_id)}`;
    console.log("Invite URL:", inviteUrl);

    const safeInvitedBy = escapeHtml(invited_by);
    const safeRole = escapeHtml(role);
    const safeUrl = escapeHtml(inviteUrl);

    // Build HTML content on single lines to avoid line-break encoding issues
    const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;"><h1 style="color:#2563eb;margin-bottom:20px;">You're Invited!</h1><p style="font-size:16px;line-height:1.6;margin-bottom:20px;">${safeInvitedBy} has invited you to join their organization on B2BNest as a <strong>${safeRole}</strong>.</p><p style="font-size:16px;line-height:1.6;margin-bottom:30px;">B2BNest is a comprehensive business management platform with project management, CRM, document generation, and AI-powered features to help your business grow.</p><div style="text-align:center;margin:30px 0;"><a href="${safeUrl}" style="background-color:#2563eb;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Accept Invitation</a></div><p style="font-size:14px;color:#666;margin-top:30px;">If you can't click the button, copy and paste this URL into your browser:<br><a href="${safeUrl}" style="color:#2563eb;">${safeUrl}</a></p><hr style="border:none;height:1px;background-color:#e5e7eb;margin:30px 0;"><p style="font-size:12px;color:#999;text-align:center;">This invitation was sent by ${safeInvitedBy}. If you didn't expect this invitation, you can safely ignore this email.</p></div></body></html>`;

    console.log("Sending invitation email via Gmail SMTP");

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
      from: gmailFrom!,
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
      JSON.stringify({ error: "Failed to send invitation email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
