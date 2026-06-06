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

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_STEPS = 10;
const MAX_BODY = 1600;

// per-instance in-memory limiter (best-effort; not strict cross-region)
const bucket = new Map<string, { count: number; reset: number }>();
function rateLimit(userId: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = bucket.get(userId);
  if (!b || b.reset < now) {
    bucket.set(userId, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
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

  if (!rateLimit(userId)) return json({ error: 'rate_limited' }, 429);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const steps = Array.isArray(body?.steps) ? body.steps : null;
  if (!steps || steps.length === 0) return json({ error: 'no_steps' }, 400);
  if (steps.length > MAX_STEPS) return json({ error: 'too_many_steps' }, 400);
  const workflowId = typeof body?.workflow_id === 'string' ? body.workflow_id : null;

  // Load WhatsApp creds (only if any whatsapp step present)
  const needsWa = steps.some((s: any) => s?.type === 'whatsapp.send');
  let wa: { auth_token: string; account_sid: string; from_number: string; channel: string } | null = null;
  if (needsWa) {
    const { data: toks, error: tErr } = await supabase.rpc('get_integration_tokens', {
      p_integration_name: 'whatsapp_twilio',
      p_user_id: userId,
    });
    if (tErr || !toks?.[0]?.access_token) {
      return json({ error: 'whatsapp_not_connected' }, 400);
    }
    const { data: ui, error: uiErr } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', userId)
      .eq('integration_name', 'whatsapp_twilio')
      .maybeSingle();
    if (uiErr || !ui?.metadata?.account_sid || !ui?.metadata?.from_number) {
      return json({ error: 'whatsapp_metadata_missing' }, 400);
    }
    wa = {
      auth_token: toks[0].access_token as string,
      account_sid: ui.metadata.account_sid as string,
      from_number: ui.metadata.from_number as string,
      channel: (ui.metadata.channel as string) || 'whatsapp',
    };
  }

  const results: any[] = [];

  for (const step of steps) {
    if (step?.type !== 'whatsapp.send') {
      results.push({ ok: false, error: 'unsupported_step' });
      continue;
    }
    const to = String(step.to ?? '');
    const text = String(step.body ?? '');
    const mediaUrl = step.mediaUrl ? String(step.mediaUrl) : null;

    if (!E164.test(to)) {
      results.push({ ok: false, error: 'invalid_to' });
      await supabase.from('workflow_run_logs').insert({
        user_id: userId, workflow_id: workflowId, step: 'whatsapp.send',
        status: 'error', provider: 'twilio',
        request_summary: { channel: wa!.channel, body_length: text.length },
        response_summary: { error: 'invalid_to' },
      });
      continue;
    }
    if (!text || text.length > MAX_BODY) {
      results.push({ ok: false, error: 'invalid_body' });
      continue;
    }
    if (mediaUrl && !/^https:\/\//.test(mediaUrl)) {
      results.push({ ok: false, error: 'invalid_media_url' });
      continue;
    }

    const fromAddr = wa!.channel === 'whatsapp' ? `whatsapp:${wa!.from_number}` : wa!.from_number;
    const toAddr = wa!.channel === 'whatsapp' ? `whatsapp:${to}` : to;

    const form = new URLSearchParams({ To: toAddr, From: fromAddr, Body: text });
    if (mediaUrl) form.append('MediaUrl', mediaUrl);

    let twilioRes: Response;
    try {
      twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${wa!.account_sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${wa!.account_sid}:${wa!.auth_token}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        },
      );
    } catch (e) {
      results.push({ ok: false, error: 'network_error' });
      await supabase.from('workflow_run_logs').insert({
        user_id: userId, workflow_id: workflowId, step: 'whatsapp.send',
        status: 'error', provider: 'twilio',
        request_summary: { channel: wa!.channel, body_length: text.length },
        response_summary: { error: 'network_error', message: String(e) },
      });
      continue;
    }

    const twilioJson: any = await twilioRes.json().catch(() => ({}));
    if (!twilioRes.ok) {
      results.push({ ok: false, error: 'twilio_error', code: twilioJson.code, message: twilioJson.message });
      await supabase.from('workflow_run_logs').insert({
        user_id: userId, workflow_id: workflowId, step: 'whatsapp.send',
        status: 'error', provider: 'twilio',
        request_summary: { channel: wa!.channel, body_length: text.length },
        response_summary: { status: twilioRes.status, code: twilioJson.code, message: twilioJson.message },
      });
      continue;
    }

    results.push({ ok: true, sid: twilioJson.sid });
    await supabase.from('workflow_run_logs').insert({
      user_id: userId, workflow_id: workflowId, step: 'whatsapp.send',
      status: 'ok', provider: 'twilio',
      request_summary: { channel: wa!.channel, body_length: text.length },
      response_summary: { sid: twilioJson.sid, status: twilioJson.status },
    });
  }

  return json({ ok: true, results });
});
