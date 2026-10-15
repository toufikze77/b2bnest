// PREPARED, NOT DEPLOYED. Invoke only with the service role key (e.g. a scheduled job added after approval).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { makeHandler, BeforeDataError } from "./handler.ts";
import { sendSmtp, SmtpStageError } from "../workflow-send-email/smtp.ts";
import { resolveSmtp } from "../workflow-send-email/handler.ts";

const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", key, { auth: { persistSession: false } });

serve(makeHandler({
  env: (n) => Deno.env.get(n),
  isServiceCall: (h) => !!key && h === `Bearer ${key}`,
  claim: async (limit) => {
    const { data, error } = await admin.rpc("onboarding_outbox_claim", { _limit: limit });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  finish: async (id, outcome, reply) => {
    const { error } = await admin.rpc("onboarding_outbox_finish", { _id: id, _outcome: outcome, _reply: reply });
    if (error) console.error("onboarding-email-sender: finish failed", { id, outcome }); // row then turns "uncertain" after its lock
  },
  send: async (to, subject, text) => {
    const cfg = resolveSmtp((n) => Deno.env.get(n));
    if (!cfg) throw new BeforeDataError("email is not configured");
    try {
      const r = await sendSmtp(cfg, { from: cfg.from, to: [to], subject, content: text });
      return r.reply;
    } catch (e) {
      if (e instanceof SmtpStageError && !e.afterData) throw new BeforeDataError(e.message);
      throw e;
    }
  },
}));
