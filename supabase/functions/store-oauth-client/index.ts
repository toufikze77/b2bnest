import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { guardedDenoServeNarrow } from '../_shared/demo-guard.ts'; // Edge Functions CORS batch A (docs/hmrc-p7d/README.md): answers carry the narrowed CORS headers (corsFor), never '*'.
import { validate } from './validate.ts'
// Demo read-only: demo people get 403 (docs/demo-readonly)
// Saves a person's own OAuth app details (client id and secret) for one provider before the Connect flow starts.
// user_integrations has no INSERT or UPDATE policy for users, on purpose, so the browser can't write it: this function
// checks the caller's token, takes the user id from it (never from the body), checks the fields, and writes with the
// service role. Credential values are never logged.

guardedDenoServeNarrow()(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const body = await req.json().catch(() => null)
    const checked = validate(body?.provider, body?.credentials)
    if (!checked.ok) {
      return new Response(JSON.stringify({ error: checked.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // UNIQUE (user_id, integration_name) (user_integrations_user_id_integration_name_key). Only these columns are sent,
    // so on conflict only metadata and is_connected change: tokens, expiry and the other columns are left as they are.
    const { error } = await supabase
      .from('user_integrations')
      .upsert(
        { user_id: userId, integration_name: checked.provider, metadata: checked.metadata, is_connected: false },
        { onConflict: 'user_id,integration_name' },
      )

    if (error) {
      // The database error only (never the credentials).
      console.error(`Error storing ${checked.provider} app details:`, error.code, error.message)
      return new Response(JSON.stringify({ error: 'Failed to store credentials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (_error) {
    console.error('Error in store-oauth-client')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
