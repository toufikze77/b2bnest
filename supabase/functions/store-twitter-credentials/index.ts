import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId, credentials } = await req.json()

    if (!userId || !credentials) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate all required Twitter credentials
    const requiredFields = ['consumer_key', 'consumer_secret', 'access_token', 'access_token_secret']
    for (const field of requiredFields) {
      if (!credentials[field]) {
        return new Response(
          JSON.stringify({ error: `Missing ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store credentials using the secure function
    const { error } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: 'twitter',
      p_access_token: credentials.access_token,
      p_refresh_token: credentials.access_token_secret,
      p_metadata: {
        consumer_key: credentials.consumer_key,
        consumer_secret: credentials.consumer_secret,
      },
      p_user_id: userId
    })

    if (error) {
      console.error('Error storing Twitter credentials:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to store credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Twitter credentials stored successfully for user:', userId)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in store-twitter-credentials:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
