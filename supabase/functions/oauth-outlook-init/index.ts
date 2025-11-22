import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user has Outlook credentials configured
    const { data: integration } = await supabaseClient
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', userId)
      .eq('integration_name', 'outlook')
      .single();

    let clientId, clientSecret;

    if (integration?.metadata) {
      const metadata = typeof integration.metadata === 'string' 
        ? JSON.parse(integration.metadata) 
        : integration.metadata;
      clientId = metadata.client_id;
      clientSecret = metadata.client_secret;
    }

    // Fallback to environment variables
    if (!clientId || !clientSecret) {
      clientId = Deno.env.get('OUTLOOK_CLIENT_ID');
      clientSecret = Deno.env.get('OUTLOOK_CLIENT_SECRET');
    }

    if (!clientId || !clientSecret) {
      throw new Error('Outlook OAuth credentials not configured');
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-outlook-calendar`;
    const scope = 'Mail.ReadWrite Mail.Send offline_access';

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_mode=query` +
      `&state=${userId}`;

    return new Response(
      JSON.stringify({ authUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('OAuth init error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
