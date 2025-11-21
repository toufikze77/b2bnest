import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrelloOAuthResponse {
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

    // Initialize Supabase client first to get user credentials
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's stored credentials
    const { data: integration, error: fetchError } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'trello')
      .single()

    if (fetchError || !integration?.metadata) {
      return new Response(
        JSON.stringify({ error: 'User credentials not found. Please reconnect and provide your API credentials.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metadata = integration.metadata as { api_key?: string; api_token?: string }
    const apiKey = metadata.api_key
    const apiToken = metadata.api_token

    if (!apiKey || !apiToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials stored. Please reconnect.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for access token using user's credentials
    const trelloTokenResponse = await fetch('https://trello.com/1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: apiKey,
        client_secret: apiToken,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-trello`,
        grant_type: 'authorization_code',
      }),
    })

    const trelloData: TrelloOAuthResponse = await trelloTokenResponse.json()

    if (!trelloData.access_token) {
      console.error('Trello OAuth error:', trelloData.error)
      return new Response(
        JSON.stringify({ error: trelloData.error || 'Failed to get access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user info from Trello
    const userInfoResponse = await fetch(`https://api.trello.com/1/members/me?key=${apiKey}&token=${trelloData.access_token}`)
    const userInfo = await userInfoResponse.json()

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(trelloData.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
    const encryptedRefreshToken = trelloData.refresh_token 
      ? await encrypt(trelloData.refresh_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
      : null

    // Calculate expiration (Trello tokens typically don't expire)
    const expiresAt = trelloData.expires_in 
      ? new Date(Date.now() + trelloData.expires_in * 1000).toISOString()
      : null

    // Store integration in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'trello',
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        is_connected: true,
        metadata: {
          trello_user_id: userInfo.id,
          username: userInfo.username,
          full_name: userInfo.fullName,
          email: userInfo.email,
          avatar_url: userInfo.avatarUrl,
          scope: trelloData.scope,
        },
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Trello integration successful for user:', state)

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?trello_connected=true`,
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