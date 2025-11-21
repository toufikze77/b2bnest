import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface MicrosoftOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing required parameters');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch user's stored credentials
    const { data: integration, error: fetchError } = await supabaseClient
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'outlook_calendar')
      .single();

    if (fetchError || !integration?.metadata) {
      throw new Error('Integration credentials not found');
    }

    const metadata = typeof integration.metadata === 'string' 
      ? JSON.parse(integration.metadata) 
      : integration.metadata;

    const clientId = metadata.client_id;
    const clientSecret = metadata.client_secret;

    if (!clientId || !clientSecret) {
      throw new Error('Client credentials not configured');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-outlook-calendar`;

    // Exchange code for tokens
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Microsoft token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens: MicrosoftOAuthResponse = await tokenResponse.json();

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo = { email: '', name: '' };
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      userInfo.email = profile.mail || profile.userPrincipalName || '';
      userInfo.name = profile.displayName || '';
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens
    const { error: rpcError } = await supabaseClient.rpc('store_integration_tokens', {
      p_user_id: state,
      p_integration_name: 'outlook_calendar',
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: expiresAt.toISOString(),
      p_metadata: {
        ...metadata,
        email: userInfo.email,
        name: userInfo.name,
      },
    });

    if (rpcError) {
      console.error('Error storing tokens:', rpcError);
      throw rpcError;
    }

    // Redirect back to app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/business-tools?integration=outlook_calendar&status=success`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
