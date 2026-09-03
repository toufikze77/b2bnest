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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Server misconfigured');
    }

    // 1) Identify the caller from their JWT (never trust a user_id from the body)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // 2) Trusted server-side client — service role stays inside this function only
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { code } = body ?? {};
    if (!code || typeof code !== 'string') {
      throw new Error('Missing required parameters');
    }

    // 3) OAuth client credentials are resolved server-side from the caller's own
    //    hmrc_settings row. Client-supplied clientId/clientSecret/redirectUri are ignored.
    const { data: settings, error: settingsError } = await adminClient
      .from('hmrc_settings')
      .select('client_id, client_secret, redirect_uri, sandbox_mode, organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError || !settings?.client_id || !settings?.redirect_uri) {
      throw new Error('HMRC settings not configured for this user');
    }

    const { data: clientSecret, error: secretError } = await adminClient.rpc('decrypt_hmrc_token', {
      encrypted_token: settings.client_secret,
    });
    if (secretError || !clientSecret) {
      throw new Error('HMRC client secret not configured');
    }

    const sandboxMode = settings.sandbox_mode !== false;
    const tokenUrl = sandboxMode ? HMRC_SANDBOX_TOKEN_URL : HMRC_PROD_TOKEN_URL;

    console.log('Exchanging HMRC OAuth code for tokens...');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: settings.client_id,
        client_secret: clientSecret as string,
        redirect_uri: settings.redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      // Never echo the provider body back to the browser (it can contain credentials)
      console.error('HMRC token exchange failed with status', tokenResponse.status);
      throw new Error('HMRC OAuth token exchange failed');
    }

    const tokenData = await tokenResponse.json();
    console.log('Received tokens from HMRC');

    // 4) Encryption runs with the service role inside this trusted context only
    const { data: encryptedAccessToken, error: encAccessError } = await adminClient.rpc(
      'encrypt_hmrc_token',
      { token: tokenData.access_token }
    );
    if (encAccessError || !encryptedAccessToken) {
      throw new Error('Failed to secure authentication tokens');
    }

    let encryptedRefreshToken: string | null = null;
    if (tokenData.refresh_token) {
      const { data: enc, error: encRefreshError } = await adminClient.rpc('encrypt_hmrc_token', {
        token: tokenData.refresh_token,
      });
      if (encRefreshError) throw new Error('Failed to secure authentication tokens');
      encryptedRefreshToken = (enc as string) ?? null;
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // 5) Tenant binding: only an organization the caller is an active member of
    let organizationId: string | null = null;
    const { data: membership } = await adminClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (settings.organization_id && membership?.organization_id === settings.organization_id) {
      organizationId = settings.organization_id;
    } else {
      organizationId = membership?.organization_id ?? null;
    }

    const { error: insertError } = await adminClient
      .from('hmrc_integrations')
      .upsert({
        user_id: user.id,
        organization_id: organizationId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
        is_connected: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,organization_id' });

    if (insertError) {
      console.error('Failed to store HMRC tokens:', insertError.message);
      throw new Error('Failed to store authentication tokens');
    }

    console.log('Successfully stored HMRC tokens for user:', user.id);

    // 6) No raw or encrypted token is returned to the browser
    return new Response(
      JSON.stringify({ success: true, message: 'HMRC authentication successful', expires_at: expiresAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('HMRC OAuth error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
