import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FacebookOAuthResponse {
  access_token: string
  token_type: string
  expires_in?: number
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

    const clientId = Deno.env.get('FACEBOOK_APP_ID')
    const clientSecret = Deno.env.get('FACEBOOK_APP_SECRET')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-facebook`

    if (!clientId || !clientSecret) {
      throw new Error('Facebook API credentials not configured')
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?` + new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }))

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange error:', errorText)
      throw new Error('Failed to exchange authorization code')
    }

    const tokenData: FacebookOAuthResponse = await tokenResponse.json()

    // Get user profile
    const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`)
    const profileData = await profileResponse.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    // Store tokens using RPC function
    const { error: storeError } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: 'facebook',
      p_access_token: tokenData.access_token,
      p_refresh_token: null,
      p_expires_at: expiresAt,
      p_metadata: {
        id: profileData.id,
        name: profileData.name,
        email: profileData.email,
        picture: profileData.picture?.data?.url,
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
        Location: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/settings?integration=facebook`,
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
