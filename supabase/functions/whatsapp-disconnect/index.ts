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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const token = auth.replace('Bearer ', '');
  const { data: claimData, error: claimErr } = await supabase.auth.getClaims(token);
  if (claimErr || !claimData?.claims?.sub) return json({ error: 'unauthorized' }, 401);
  const userId = claimData.claims.sub;

  const { error } = await supabase
    .from('user_integrations')
    .update({ is_connected: false, access_token: null, refresh_token: null })
    .eq('user_id', userId)
    .eq('integration_name', 'whatsapp_twilio');

  if (error) return json({ error: 'disconnect_failed', detail: error.message }, 500);
  return json({ ok: true });
});
