import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encrypt } from '../shared/crypto.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface OneDriveOAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user_id
    
    console.log('OneDrive OAuth callback received', { code: !!code, state });

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch user's stored credentials
    const { data: integrationData, error: fetchError } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', state)
      .eq('integration_name', 'onedrive')
      .single();

    if (fetchError || !integrationData) {
      console.error('Failed to fetch user credentials:', fetchError);
      throw new Error('User credentials not found');
    }

    const clientId = integrationData.metadata?.client_id;
    const clientSecret = integrationData.metadata?.client_secret;

    if (!clientId || !clientSecret) {
      throw new Error('Missing client credentials in metadata');
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-onedrive`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OneDrive token exchange failed:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData: OneDriveOAuthResponse = await tokenResponse.json();
    console.log('OneDrive token received successfully');

    // Fetch user information
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    console.log('OneDrive user data fetched');

    // Encrypt tokens
    const encryptionSecret = Deno.env.get('INTEGRATION_ENCRYPTION_SECRET') ?? '';
    const encryptedAccessToken = await encrypt(tokenData.access_token, encryptionSecret);
    const encryptedRefreshToken = tokenData.refresh_token 
      ? await encrypt(tokenData.refresh_token, encryptionSecret)
      : null;

    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update integration with tokens
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        is_connected: true,
        connected_at: new Date().toISOString(),
        metadata: {
          ...integrationData.metadata,
          user_name: userData.displayName,
          user_email: userData.mail || userData.userPrincipalName,
        },
      })
      .eq('user_id', state)
      .eq('integration_name', 'onedrive');

    if (updateError) {
      console.error('Failed to update integration:', updateError);
      throw updateError;
    }

    console.log('OneDrive integration updated successfully');

    // Redirect back to the application
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('APP_URL') || 'http://localhost:8080'}/business-tools?integration=onedrive&status=success`,
      },
    });
  } catch (error) {
    console.error('Error in OneDrive OAuth callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
