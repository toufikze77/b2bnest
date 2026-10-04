import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { makeHandler, redactEmails } from "./handler.ts";
import { probeSmtp } from "./probe.ts";
import { sendSmtp } from "./smtp.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

serve(makeHandler({
  env: (n) => Deno.env.get(n),
  getUser: async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },
  isSuperAdmin: async (userId) => {
    const { data } = await admin.rpc("is_super_admin", { _user_id: userId });
    return data === true;
  },
  probe: (cfg) => probeSmtp(cfg),
  // Own SMTP sender (denomailer hid the failing command behind "invalid cmd").
  send: async (cfg, mail) => {
    const r = await sendSmtp(cfg, mail);
    console.log("workflow-send-email: server queued", { reply: redactEmails(r.reply).slice(0, 200) });
  },
}));
