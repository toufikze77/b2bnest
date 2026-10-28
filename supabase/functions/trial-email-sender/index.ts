// In supabase/functions, NOT deployed. Invoke only with the service role key (the scheduled job in
// docs/phase13/schedule.sql, after approval). Nothing is sent while public.trial_email_settings.enabled is false.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { BeforeDataError, makeHandler } from "./handler.ts";
import { buildAlternativeMessage } from "./mime.ts";
import { smtpOnly } from "../onboarding-email-sender/handler.ts";
import { sendSmtp, SmtpStageError } from "../workflow-send-email/smtp.ts";
import { resolveSmtp } from "../workflow-send-email/handler.ts";

const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", key, { auth: { persistSession: false } });

serve(makeHandler({
  isServiceCall: (h) => !!key && h === `Bearer ${key}`,
  claim: async (limit) => {
    const { data, error } = await admin.rpc("trial_email_claim", { _limit: limit });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  finish: async (id, outcome, reply) => {
    const { error } = await admin.rpc("trial_email_finish", { _id: id, _outcome: outcome, _reply: reply });
    if (error) console.error("trial-email-sender: finish failed", { id, outcome }); // the row then turns "uncertain" after its lock
  },
  send: async (m) => {
    let cfg;
    try {
      cfg = smtpOnly(resolveSmtp((n) => Deno.env.get(n))); // Microsoft 365 SMTP_* only, never the Gmail fallback
    } catch (e) {
      throw new BeforeDataError((e as Error).message);
    }
    const raw = buildAlternativeMessage({ from: cfg.from, to: m.to, subject: m.subject, text: m.text, html: m.html, listUnsubscribe: m.listUnsubscribe });
    try {
      const r = await sendSmtp(cfg, { from: cfg.from, to: [m.to], subject: m.subject }, raw);
      return r.reply;
    } catch (e) {
      if (e instanceof SmtpStageError && !e.afterData) throw new BeforeDataError(e.message);
      throw e;
    }
  },
}));
