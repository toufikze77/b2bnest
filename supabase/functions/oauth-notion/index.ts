import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotionOAuthResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  workspace_id?: string
  workspace_name?: string
  workspace_icon?: string
  bot_id?: string
  owner?: {
    user?: {
      id: string
      name: string
    }
  }
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
      .eq('integration_name', 'notion')
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
    const notionTokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-notion`,
      }),
    })

    const notionData: NotionOAuthResponse = await notionTokenResponse.json()

    if (!notionData.access_token) {
      console.error('Notion OAuth error:', notionData.error)
      return new Response(
        JSON.stringify({ error: notionData.error || 'Failed to get access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(notionData.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
    const encryptedRefreshToken = notionData.refresh_token 
      ? await encrypt(notionData.refresh_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
      : null

    // Calculate expiration
    const expiresAt = notionData.expires_in 
      ? new Date(Date.now() + notionData.expires_in * 1000).toISOString()
      : null

    // Store integration in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'notion',
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        is_connected: true,
        metadata: {
          workspace_id: notionData.workspace_id,
          workspace_name: notionData.workspace_name,
          workspace_icon: notionData.workspace_icon,
          bot_id: notionData.bot_id,
          owner: notionData.owner,
        },
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Notion integration successful for user:', state)

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?notion_connected=true`,
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