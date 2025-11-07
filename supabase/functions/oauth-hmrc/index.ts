import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const HMRC_SANDBOX_TOKEN_URL = 'https://test-api.service.hmrc.gov.uk/oauth/token';
const HMRC_PROD_TOKEN_URL = 'https://api.service.hmrc.gov.uk/oauth/token';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { code, state, clientId, clientSecret, redirectUri, sandboxMode = true } = await req.json();

    if (!code || !clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing required parameters');
    }

    console.log('Exchanging HMRC OAuth code for tokens...');

    // Exchange authorization code for access token
    const tokenUrl = sandboxMode ? HMRC_SANDBOX_TOKEN_URL : HMRC_PROD_TOKEN_URL;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('HMRC token exchange failed:', errorData);
      throw new Error(`HMRC OAuth failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Received tokens from HMRC');

    // Encrypt tokens before storing
    const { data: encryptedAccessToken } = await supabaseClient.rpc('encrypt_hmrc_token', {
      token: tokenData.access_token,
    });

    const { data: encryptedRefreshToken } = tokenData.refresh_token
      ? await supabaseClient.rpc('encrypt_hmrc_token', { token: tokenData.refresh_token })
      : { data: null };

    // Calculate expiration time
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Get user's organization
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Store tokens in database
    const { error: insertError } = await supabaseClient
      .from('hmrc_integrations')
      .upsert({
        user_id: user.id,
        organization_id: orgMember?.organization_id || null,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
        is_connected: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,organization_id'
      });

    if (insertError) {
      console.error('Failed to store HMRC tokens:', insertError);
      throw new Error('Failed to store authentication tokens');
    }

    console.log('Successfully stored HMRC tokens for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'HMRC authentication successful',
        expires_at: expiresAt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('HMRC OAuth error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
