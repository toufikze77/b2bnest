import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeHandler, memoryRateLimit } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
// Run-log rows are written with the service role: since Phase 15 a browser session may only record skipped steps.
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const asUser = (auth: string) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });

Deno.serve(makeHandler({
  getUserId: async (auth) => {
    const { data, error } = await asUser(auth).auth.getClaims(auth.replace('Bearer ', ''));
    return error || !data?.claims?.sub ? null : data.claims.sub;
  },
  rateLimit: memoryRateLimit(30, 60_000),
  loadWhatsApp: async (userId, auth) => {
    const supabase = asUser(auth);
    const { data: toks, error: tErr } = await supabase.rpc('get_integration_tokens', { p_integration_name: 'whatsapp_twilio', p_user_id: userId });
    if (tErr || !toks?.[0]?.access_token) return { ok: false, error: 'whatsapp_not_connected' };
    const { data: ui, error: uiErr } = await supabase.from('user_integrations').select('metadata')
      .eq('user_id', userId).eq('integration_name', 'whatsapp_twilio').maybeSingle();
    if (uiErr || !ui?.metadata?.account_sid || !ui?.metadata?.from_number) return { ok: false, error: 'whatsapp_metadata_missing' };
    return { ok: true, account: {
      auth_token: toks[0].access_token as string, account_sid: ui.metadata.account_sid as string,
      from_number: ui.metadata.from_number as string, channel: (ui.metadata.channel as string) || 'whatsapp',
    } };
  },
  twilio: (wa, form) => fetch(`https://api.twilio.com/2010-04-01/Accounts/${wa.account_sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${wa.account_sid}:${wa.auth_token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }),
  log: async (row) => { await service.from('workflow_run_logs').insert(row); },
}));
