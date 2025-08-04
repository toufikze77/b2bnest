import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotionOAuthResponse {
  access_token?: string
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

    // Exchange code for access token
    const notionTokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${Deno.env.get('NOTION_CLIENT_ID')}:${Deno.env.get('NOTION_CLIENT_SECRET')}`)}`,
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store integration in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'notion',
        access_token: notionData.access_token,
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