import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json().catch(() => ({}));
    
    // OAuth client IDs are safe to expose publicly
    const allConfig: Record<string, string | undefined> = {
      google: Deno.env.get('GOOGLE_CLIENT_ID'),
      icloud: Deno.env.get('APPLE_SERVICES_ID'),
      outlook: Deno.env.get('MICROSOFT_CLIENT_ID'),
      onedrive: Deno.env.get('MICROSOFT_CLIENT_ID'),
      twitter: Deno.env.get('TWITTER_CONSUMER_KEY'),
      linkedin: Deno.env.get('LINKEDIN_CLIENT_ID'),
      facebook: Deno.env.get('FACEBOOK_APP_ID'),
    };

    // If a specific provider is requested, return just that config
    const config = provider && allConfig[provider] 
      ? { clientId: allConfig[provider], scope: '' }
      : allConfig;

    return new Response(
      JSON.stringify(config),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (error) {
    console.error('Error getting OAuth config:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});