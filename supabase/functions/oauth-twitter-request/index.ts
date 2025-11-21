import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OAuth 1.0a request token endpoint for Twitter
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    
    if (!userId) {
      throw new Error('User ID is required')
    }

    const consumerKey = Deno.env.get('TWITTER_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('TWITTER_CONSUMER_SECRET')
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-twitter`

    if (!consumerKey || !consumerSecret) {
      throw new Error('Twitter API credentials not configured')
    }

    // Step 1: Request token
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
      oauth_callback: `${callbackUrl}?state=${userId}`,
    }

    const signatureBaseString = `POST&${encodeURIComponent('https://api.twitter.com/oauth/request_token')}&${encodeURIComponent(
      Object.entries(oauthParams)
        .sort()
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    )}`

    const signingKey = `${encodeURIComponent(consumerSecret)}&`
    const signature = createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64')

    const authHeader = 'OAuth ' + 
      Object.entries({ ...oauthParams, oauth_signature: signature })
        .sort()
        .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
        .join(', ')

    const response = await fetch('https://api.twitter.com/oauth/request_token', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get request token')
    }

    const responseText = await response.text()
    const params = new URLSearchParams(responseText)
    const oauthToken = params.get('oauth_token')

    if (!oauthToken) {
      throw new Error('No oauth_token in response')
    }

    // Return authorization URL
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
