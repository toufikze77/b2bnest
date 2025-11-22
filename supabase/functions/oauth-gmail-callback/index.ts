import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface GoogleOAuthResponse {
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

    // Fetch user's stored credentials or use environment variables
    const { data: integration } = await supabaseClient
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'gmail')
      .single();

    let clientId, clientSecret;

    if (integration?.metadata) {
      const metadata = typeof integration.metadata === 'string' 
        ? JSON.parse(integration.metadata) 
        : integration.metadata;
      clientId = metadata.client_id;
      clientSecret = metadata.client_secret;
    }

    if (!clientId || !clientSecret) {
      clientId = Deno.env.get('GMAIL_CLIENT_ID');
      clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    }

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured');
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-gmail-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
      console.error('Google token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens: GoogleOAuthResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store or update tokens
    const { error: upsertError } = await supabaseClient
      .from('user_integrations')
      .upsert({
        user_id: state,
        integration_name: 'gmail',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        is_connected: true,
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      }, {
        onConflict: 'user_id,integration_name',
      });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      throw upsertError;
    }

    // Redirect back to app
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/business-tools/notepro?integration=gmail&status=success`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/business-tools/notepro?integration=gmail&status=error`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  }
});
