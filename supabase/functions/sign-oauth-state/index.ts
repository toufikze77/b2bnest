import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { signOAuthState } from '../_shared/oauth-state.ts';
import { guardedDenoServeNarrow } from '../_shared/demo-guard.ts'; // Edge Functions CORS batch A (docs/hmrc-p7d/README.md): answers carry the narrowed CORS headers (corsFor), never '*'.
// Demo read-only: demo people get 403 (docs/demo-readonly)

guardedDenoServeNarrow()(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    // getUser(token): the supabase-js pinned above predates getClaims, which threw "is not a function".
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const state = await signOAuthState(data.user.id);
    return new Response(JSON.stringify({ state }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('sign-oauth-state error', e);
    return new Response(JSON.stringify({ error: 'Failed to sign state' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
