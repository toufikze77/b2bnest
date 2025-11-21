import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const oauth_token = url.searchParams.get('oauth_token')
    const oauth_verifier = url.searchParams.get('oauth_verifier')
    const state = url.searchParams.get('state')

    if (!oauth_token || !oauth_verifier || !state) {
      throw new Error('Missing required OAuth parameters')
    }

    const consumerKey = Deno.env.get('TWITTER_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('TWITTER_CONSUMER_SECRET')

    if (!consumerKey || !consumerSecret) {
      throw new Error('Twitter API credentials not configured')
    }

    // Exchange OAuth verifier for access token
    const tokenResponse = await fetch('https://api.twitter.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        oauth_token,
        oauth_verifier,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange OAuth token')
    }

    const tokenText = await tokenResponse.text()
    const tokenParams = new URLSearchParams(tokenText)
    const accessToken = tokenParams.get('oauth_token')
    const accessTokenSecret = tokenParams.get('oauth_token_secret')
    const userId = tokenParams.get('user_id')
    const screenName = tokenParams.get('screen_name')

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Failed to get access tokens')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store tokens using RPC function
    const { error: storeError } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: 'twitter',
      p_access_token: accessToken,
      p_refresh_token: accessTokenSecret, // Store token secret as refresh token
      p_expires_at: null,
      p_metadata: {
        user_id: userId,
        screen_name: screenName,
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
        Location: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/settings?integration=twitter`,
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
