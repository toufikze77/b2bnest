import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    const state = url.searchParams.get('state') // user_id
    
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client to get user's stored credentials
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's stored Google credentials
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'google_calendar')
      .single()

    if (integrationError || !integration?.metadata) {
      console.error('Failed to get user credentials:', integrationError)
      return new Response(
        JSON.stringify({ error: 'User credentials not found. Please reconnect.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metadata = typeof integration.metadata === 'string' 
      ? JSON.parse(integration.metadata) 
      : integration.metadata

    const clientId = metadata.client_id || Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = metadata.client_secret || Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for access token using user's credentials
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

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${googleData.access_token}`,
      },
    })
    const userInfo = await userInfoResponse.json()

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
        client_id: clientId, // Keep client_id for token refresh
      },
      p_user_id: state
    })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Google Calendar integration successful for user:', state)

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?google_connected=true`,
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
