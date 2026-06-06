import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: auth } },
  });

  const token = auth.replace('Bearer ', '');
  const { data: claimData, error: claimErr } = await supabase.auth.getClaims(token);
  if (claimErr || !claimData?.claims?.sub) return json({ error: 'unauthorized' }, 401);
  const userId = claimData.claims.sub;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { account_sid, auth_token, from_number, channel } = body ?? {};
  if (typeof account_sid !== 'string' || !/^AC[0-9a-fA-F]{32}$/.test(account_sid))
    return json({ error: 'invalid_account_sid' }, 400);
  if (typeof auth_token !== 'string' || auth_token.length < 16 || auth_token.length > 256)
    return json({ error: 'invalid_auth_token' }, 400);
  if (typeof from_number !== 'string' || !/^\+[1-9]\d{6,14}$/.test(from_number))
    return json({ error: 'invalid_from_number' }, 400);
  const ch = channel === 'sms' ? 'sms' : 'whatsapp';

  // Verify with Twilio
  const verifyRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
    headers: {
      Authorization: 'Basic ' + btoa(`${account_sid}:${auth_token}`),
    },
  });
  if (!verifyRes.ok) {
    return json({ error: 'twilio_verification_failed', status: verifyRes.status }, 400);
  }

  // Store via RPC (encrypts and audits)
  const { data, error } = await supabase.rpc('store_integration_tokens', {
    p_integration_name: 'whatsapp_twilio',
    p_access_token: auth_token,
    p_refresh_token: null,
    p_expires_at: null,
    p_metadata: { account_sid, from_number, channel: ch, verified: true },
    p_user_id: userId,
  });
  if (error) return json({ error: 'store_failed', detail: error.message }, 500);

  return json({ ok: true, integration_id: data, verified_at: new Date().toISOString() });
});
