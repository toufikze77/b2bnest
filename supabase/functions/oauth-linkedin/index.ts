import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LinkedInOAuthResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
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
      throw new Error('Missing authorization code or state')
    }

    // Initialize Supabase client to get user's stored credentials
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's stored LinkedIn credentials
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'linkedin')
      .single()

    if (integrationError || !integration?.metadata) {
      console.error('Failed to get user credentials:', integrationError)
      throw new Error('User credentials not found. Please reconnect.')
    }

    const metadata = typeof integration.metadata === 'string' 
      ? JSON.parse(integration.metadata) 
      : integration.metadata

    const clientId = metadata.client_id || Deno.env.get('LINKEDIN_CLIENT_ID')
    const clientSecret = metadata.client_secret || Deno.env.get('LINKEDIN_CLIENT_SECRET')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-linkedin`

    if (!clientId || !clientSecret) {
      throw new Error('LinkedIn API credentials not configured')
    }

    // Exchange code for access token using user's credentials
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange error:', errorText)
      throw new Error('Failed to exchange authorization code')
    }

    const tokenData: LinkedInOAuthResponse = await tokenResponse.json()

    // Get user profile
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const profileData = await profileResponse.json()

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Store tokens using RPC function
    const { error: storeError } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: 'linkedin',
      p_access_token: tokenData.access_token,
      p_refresh_token: tokenData.refresh_token || null,
      p_expires_at: expiresAt,
      p_metadata: {
        name: profileData.name,
        email: profileData.email,
        picture: profileData.picture,
        sub: profileData.sub,
        client_id: clientId, // Keep client_id for token refresh
      },
      p_user_id: state,
    })

    if (storeError) {
      console.error('Store error:', storeError)
      throw storeError
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?integration=linkedin`,
      },
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
