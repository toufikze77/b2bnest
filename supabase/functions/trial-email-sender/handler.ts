// Trial emails sender (Phase 13) — in supabase/functions, NOT deployed. Same pattern as onboarding-email-sender:
// service-role callers only; claims a bounded batch from public.trial_email_claim (which re-checks every rule and
// returns nothing while public.trial_email_settings.enabled is false); sends through the Microsoft 365 SMTP_*
// settings only; reports each outcome with public.trial_email_finish. A failure before DATA is "failed" (retried later
// by the database with backoff); anything during or after DATA is "uncertain" and is never resent automatically.
import { renderTrialEmail, type TrialEmailKind } from "../_shared/trial-emails.ts";

export type Claimed = { id: string; kind: TrialEmailKind; recipient_email: string; first_name: string | null; trial_ends_at: string;
  days_left: number; unsubscribe_token: string; attempts: number };
export type Outcome = "accepted_by_provider" | "failed" | "uncertain" | "cancelled";
export class BeforeDataError extends Error {}
export type OutMail = { to: string; subject: string; text: string; html: string; listUnsubscribe: string };
export type Deps = {
  isServiceCall: (h: string | null) => boolean;
  claim: (n: number) => Promise<Claimed[]>;
  finish: (id: string, o: Outcome, reply: string) => Promise<void>;
  send: (mail: OutMail) => Promise<string>;
};

export const BATCH = 20;
const KINDS: TrialEmailKind[] = ["ending_soon", "ended", "follow_up"];
const scrub = (s: string) => s.replace(/[^\s@<>]+@[^\s@<>]+/g, "[email]").slice(0, 300);

export const makeHandler = (d: Deps) => async (req: Request): Promise<Response> => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (!d.isServiceCall(req.headers.get("Authorization"))) return json({ error: "Unauthorized" }, 401);
  const rows = await d.claim(BATCH);
  const r = { accepted: 0, failed: 0, uncertain: 0, cancelled: 0 };
  for (const c of rows) {
    if (!KINDS.includes(c.kind) || !c.recipient_email || !/^[0-9a-f]{64}$/.test(c.unsubscribe_token ?? "")) {
      await d.finish(c.id, "cancelled", "cannot build this email"); r.cancelled++; continue;
    }
    const mail = renderTrialEmail({ kind: c.kind, to: c.recipient_email, firstName: c.first_name, trialEndsAt: c.trial_ends_at,
      daysLeft: c.days_left, unsubscribeToken: c.unsubscribe_token });
    try {
      const reply = await d.send({ to: c.recipient_email, subject: mail.subject, text: mail.text, html: mail.html, listUnsubscribe: mail.unsubscribeUrl });
      await d.finish(c.id, "accepted_by_provider", reply); r.accepted++;
    } catch (e) {
      const o: Outcome = e instanceof BeforeDataError ? "failed" : "uncertain"; // uncertain is never resent automatically
      await d.finish(c.id, o, scrub(String((e as Error)?.message ?? e))); r[o === "failed" ? "failed" : "uncertain"]++;
    }
  }
  return json({ status: "ran", claimed: rows.length, ...r });
};
