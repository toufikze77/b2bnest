import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // OAuth client IDs are safe to expose publicly
    const config = {
      google: Deno.env.get('GOOGLE_CLIENT_ID'),
      slack: Deno.env.get('SLACK_CLIENT_ID'), 
      notion: Deno.env.get('NOTION_CLIENT_ID'),
      trello: Deno.env.get('TRELLO_CLIENT_ID'),
    };

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