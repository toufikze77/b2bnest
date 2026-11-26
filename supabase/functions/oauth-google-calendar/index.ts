import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { verifyOAuthState } from '../_shared/oauth-state.ts'
import { demoRefusal } from '../_shared/demo-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleOAuthResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userId: string
    try { userId = await verifyOAuthState(state) } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid OAuth state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // Demo read-only: never store a connection for a demo person (docs/demo-readonly).
    { const demo = await demoRefusal(userId, corsHeaders); if (demo) return demo; }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // B2BNEST's own Google app only (the same client the Connect button used, from get-oauth-config). People no
    // longer enter a Client ID or Secret, and nothing is read from user_integrations.metadata.
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('oauth-google-calendar: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set')
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for access token with B2BNEST's Google app
    const googleTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-google-calendar`,
        grant_type: 'authorization_code',
      }),
    })

    const googleData: GoogleOAuthResponse = await googleTokenResponse.json()

    if (!googleData.access_token) {
      console.error('Google OAuth error:', googleData.error)
      return new Response(
        JSON.stringify({ error: googleData.error || 'Failed to get access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Which Google account (shown on the card). Needs the "email" scope; if it isn't granted, the card shows no address.
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${googleData.access_token}`,
      },
    })
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json().catch(() => ({})) : {}

    // Calculate expiration
    const expiresAt = googleData.expires_in 
      ? new Date(Date.now() + googleData.expires_in * 1000).toISOString()
      : null

    // Store integration tokens in database using secure function
    const { error: dbError } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: 'google_calendar',
      p_access_token: googleData.access_token,
      p_refresh_token: googleData.refresh_token || null,
      p_expires_at: expiresAt,
      p_metadata: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        scope: googleData.scope,
      },
      p_user_id: userId
    })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Google Calendar integration successful for user:', userId)

    // Back to where the person started: Business tools, Integrations tab (the card shows "Google Calendar connected").
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?tool=integrations&google_connected=true`,
      },
    })

  } catch (error) {
    console.error('OAuth error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
