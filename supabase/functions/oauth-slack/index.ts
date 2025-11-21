import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  team?: {
    id: string
    name: string
  }
  authed_user?: {
    id: string
  }
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
      .eq('integration_name', 'slack')
      .single()

    if (fetchError || !integration?.metadata) {
      return new Response(
        JSON.stringify({ error: 'User credentials not found. Please reconnect and provide your API credentials.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metadata = integration.metadata as { client_id?: string; client_secret?: string }
    const clientId = metadata.client_id
    const clientSecret = metadata.client_secret

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials stored. Please reconnect.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for access token using user's credentials
    const slackTokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-slack`,
      }),
    })

    const slackData: SlackOAuthResponse = await slackTokenResponse.json()

    if (!slackData.ok || !slackData.access_token) {
      console.error('Slack OAuth error:', slackData.error)
      return new Response(
        JSON.stringify({ error: slackData.error || 'Failed to get access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(slackData.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')

    // Store integration in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'slack',
        access_token: encryptedAccessToken,
        is_connected: true,
        metadata: {
          team_id: slackData.team?.id,
          team_name: slackData.team?.name,
          slack_user_id: slackData.authed_user?.id,
        },
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?slack_connected=true`,
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