import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { makeHandler } from "./handler.ts";
import { probeSmtp } from "./probe.ts";

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
  send: async (cfg, mail) => {
    const client = new SMTPClient({ connection: { hostname: cfg.hostname, port: cfg.port, tls: cfg.tls, auth: { username: cfg.username, password: cfg.password } } });
    try { await client.send(mail); } finally { await client.close().catch(() => {}); }
  },
}));
