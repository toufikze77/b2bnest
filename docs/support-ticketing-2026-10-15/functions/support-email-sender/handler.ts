// Support email sender — PREPARED, NOT DEPLOYED. Lives under docs/ so nothing auto-deploys.
// On approval: copy to supabase/functions/support-email-sender/, keep SUPPORT_EMAIL_ENABLED unset until the owner says go.
// Reuses the existing SMTP sender (../workflow-send-email/smtp.ts) and its SMTP_* / GMAIL_* settings. No new secrets.

export type Claimed = {
  id: string; kind: "acknowledgement" | "public_reply"; recipient_user_id: string; attempts: number;
  support_name: string; reference: string; subject: string; reply_body: string | null;
};
export type Outcome = "accepted_by_provider" | "failed" | "uncertain" | "cancelled";
export type Deps = {
  env: (n: string) => string | undefined;
  isServiceCall: (authHeader: string | null) => boolean;
  claim: (limit: number) => Promise<Claimed[]>;
  finish: (id: string, outcome: Outcome, reply: string) => Promise<void>;
  recipientEmail: (userId: string) => Promise<string | null>;
  send: (to: string, subject: string, text: string) => Promise<string>; // resolves with the server's reply
};

/** Error that happened before the message body was handed over: safe to retry. */
export class BeforeDataError extends Error {}

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 150);

/** Plain text only. Never includes private notes (the database already strips them) or attachments. */
export function buildEmail(c: Claimed, portalUrl: string): { subject: string; text: string } {
  const head = `${clean(c.support_name)} — ${c.reference}`;
  if (c.kind === "acknowledgement") {
    return {
      subject: `${head}: we've received your ticket`,
      text: `We've received your support ticket "${clean(c.subject)}" (${c.reference}).\n\nYou can view it and reply here: ${portalUrl}\n\nPlease don't reply with sensitive personal data.`,
    };
  }
  return {
    subject: `${head}: new reply`,
    text: `There is a new reply on your ticket "${clean(c.subject)}" (${c.reference}):\n\n${(c.reply_body ?? "").slice(0, 5000)}\n\nView or reply: ${portalUrl}\nAttachments, if any, are only available in the portal.`,
  };
}

export const makeHandler = (d: Deps) => async (req: Request): Promise<Response> => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (!d.isServiceCall(req.headers.get("Authorization"))) return json({ error: "Unauthorized" }, 401);
  if (d.env("SUPPORT_EMAIL_ENABLED") !== "true") return json({ status: "disabled", sent: 0 }); // inert until switched on
  const portalUrl = (d.env("SUPPORT_PORTAL_URL") || "https://www.b2bnest.online/support/portal");
  const rows = await d.claim(20);
  const result = { accepted: 0, failed: 0, uncertain: 0, cancelled: 0 };
  for (const c of rows) {
    if (c.kind === "public_reply" && !c.reply_body) { await d.finish(c.id, "cancelled", "no public reply body"); result.cancelled++; continue; }
    const to = await d.recipientEmail(c.recipient_user_id);
    if (!to) { await d.finish(c.id, "cancelled", "recipient has no email"); result.cancelled++; continue; }
    const mail = buildEmail(c, portalUrl);
    try {
      const reply = await d.send(to, mail.subject, mail.text);
      await d.finish(c.id, "accepted_by_provider", reply);
      result.accepted++;
    } catch (e) {
      // Before DATA: the server never got the message -> retry with backoff (max 5 attempts, enforced in the database).
      // During/after DATA or timeout: the provider may have accepted it -> "uncertain", never resent automatically.
      const outcome: Outcome = e instanceof BeforeDataError ? "failed" : "uncertain";
      await d.finish(c.id, outcome, String((e as Error).message).replace(/[^\s@<>]+@[^\s@<>]+/g, "[email]"));
      result[outcome === "failed" ? "failed" : "uncertain"]++;
    }
  }
  return json({ status: "ran", claimed: rows.length, ...result });
};
