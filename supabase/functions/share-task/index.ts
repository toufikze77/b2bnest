import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { escapeHtml, escapeHtmlMultiline } from "../_shared/html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShareRequest {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  method: "in_platform" | "email";
  recipientUserId?: string;
  recipientEmail?: string;
  message?: string;
  shareUrl?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: ShareRequest = await req.json();
    if (!body.taskId || !body.taskTitle || !body.method) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (body.method === "email" && !body.recipientEmail) {
      return new Response(JSON.stringify({ error: "recipientEmail required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (body.method === "in_platform" && !body.recipientUserId) {
      return new Response(JSON.stringify({ error: "recipientUserId required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: senderProfile } = await admin
      .from("profiles").select("display_name, full_name, email").eq("id", user.id).maybeSingle();
    const senderName = senderProfile?.display_name || senderProfile?.full_name || senderProfile?.email || "A teammate";

    if (body.method === "in_platform") {
      await admin.from("notifications").insert({
        user_id: body.recipientUserId,
        title: `Task shared with you: ${body.taskTitle}`,
        message: `${senderName} shared the task "${body.taskTitle}" with you.${body.message ? ` Message: ${body.message}` : ""}`,
        type: "task_shared",
      });
    } else {
      const gmailUser = Deno.env.get("GMAIL_USER");
      const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
      if (!gmailUser || !gmailPass) throw new Error("Gmail credentials not configured");

      const safeTitle = escapeHtml(body.taskTitle);
      const safeDesc = escapeHtmlMultiline(body.taskDescription || "");
      const safeMsg = escapeHtmlMultiline(body.message || "");
      const safeSender = escapeHtml(senderName);
      const safeUrl = body.shareUrl ? escapeHtml(body.shareUrl) : "";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1e40af;">${safeSender} shared a task with you</h2>
          <h3>${safeTitle}</h3>
          ${safeDesc ? `<p style="color:#555;">${safeDesc}</p>` : ""}
          ${safeMsg ? `<div style="background:#f3f4f6;padding:12px;border-radius:6px;margin:16px 0;"><strong>Message:</strong><br/>${safeMsg}</div>` : ""}
          ${safeUrl ? `<p><a href="${safeUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Open Task</a></p>` : ""}
        </div>`;

      const client = new SMTPClient({
        connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
      });
      await client.send({
        from: `B2BNest <${gmailUser}>`,
        to: body.recipientEmail!,
        subject: `${senderName} shared a task: ${body.taskTitle}`,
        html,
        content: "auto",
      });
      await client.close();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("share-task error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
