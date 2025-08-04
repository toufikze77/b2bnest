import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

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

    // Exchange code for access token
    const googleTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(googleData.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
    const encryptedRefreshToken = googleData.refresh_token 
      ? await encrypt(googleData.refresh_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
      : null

    // Calculate expiration
    const expiresAt = googleData.expires_in 
      ? new Date(Date.now() + googleData.expires_in * 1000).toISOString()
      : null

    // Store integration in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'google_calendar',
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        is_connected: true,
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          scope: googleData.scope,
        },
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