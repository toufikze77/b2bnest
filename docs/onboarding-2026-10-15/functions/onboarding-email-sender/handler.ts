// Invitation email sender — PREPARED, NOT DEPLOYED. Copy to supabase/functions/onboarding-email-sender/ only after approval.
// Reuses the existing Microsoft 365 SMTP settings (SMTP_* -> smtp.office365.com, notifications@b2bnest.online). No Gmail, no new secrets.
// Inert until ONBOARDING_EMAIL_ENABLED=true. Service-role callers only.
export type Claimed = { id: string; kind: "staff_invitation" | "customer_invitation"; recipient_email: string; company: string;
  role: string | null; organization_id: string; token: string | null; attempts: number };
export type Outcome = "accepted_by_provider" | "failed" | "uncertain" | "cancelled";
export class BeforeDataError extends Error {}
export type Deps = { env: (n: string) => string | undefined; isServiceCall: (h: string | null) => boolean;
  claim: (n: number) => Promise<Claimed[]>; finish: (id: string, o: Outcome, reply: string) => Promise<void>;
  send: (to: string, subject: string, text: string) => Promise<string> };
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 120);

/** Invitation email goes only through the SMTP_* (Microsoft 365) settings; the old Gmail fallback is refused. */
export function smtpOnly<T extends { provider: string }>(cfg: T | null): T {
  if (!cfg || cfg.provider !== "smtp") throw new BeforeDataError("SMTP_* (Microsoft 365) settings are required; Gmail fallback is disabled");
  return cfg;
}

export function buildEmail(c: Claimed, origin: string): { subject: string; text: string } | null {
  const base = origin.replace(/\/$/, "");
  if (c.kind === "staff_invitation") {
    if (!c.token) return null;
    const link = `${base}/join?token=${encodeURIComponent(c.token)}`;
    return { subject: `You're invited to join ${clean(c.company)} on B2BNEST`,
      text: `${clean(c.company)} invited you to join as ${c.role ?? "member"}.\n\nAccept: ${link}\n\nNew to B2BNEST? Create an account with this email address, verify it, and choose your own password. Already have an account? Just sign in — no password reset needed.\nThe link only works for this email address and expires in 7 days.` };
  }
  const link = `${base}/support/portal?org=${encodeURIComponent(c.organization_id)}`;
  return { subject: `${clean(c.company)}: your support portal access`,
    text: `${clean(c.company)} invited you to their support portal.\n\nOpen: ${link}\n\nNew here? Create an account with this email address, verify it and set your own password. Already have an account? Just sign in.\nThis gives access to your own support tickets only.` };
}

export const makeHandler = (d: Deps) => async (req: Request): Promise<Response> => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (!d.isServiceCall(req.headers.get("Authorization"))) return json({ error: "Unauthorized" }, 401);
  if (d.env("ONBOARDING_EMAIL_ENABLED") !== "true") return json({ status: "disabled", sent: 0 });
  const origin = d.env("APP_ORIGIN") || "https://www.b2bnest.online";
  const rows = await d.claim(20); const r = { accepted: 0, failed: 0, uncertain: 0, cancelled: 0 };
  for (const c of rows) {
    const mail = buildEmail(c, origin);
    if (!mail) { await d.finish(c.id, "cancelled", "no link available"); r.cancelled++; continue; }
    try { await d.finish(c.id, "accepted_by_provider", await d.send(c.recipient_email, mail.subject, mail.text)); r.accepted++; }
    catch (e) {
      const o: Outcome = e instanceof BeforeDataError ? "failed" : "uncertain"; // uncertain is never resent automatically
      await d.finish(c.id, o, String((e as Error).message).replace(/[^\s@<>]+@[^\s@<>]+/g, "[email]")); r[o === "failed" ? "failed" : "uncertain"]++;
    }
  }
  return json({ status: "ran", claimed: rows.length, ...r });
};
