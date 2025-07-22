import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    const { amount, currency, name, description } = await req.json();

    console.log('Creating Coinbase charge for:', { amount, currency, name, user: user?.email });

    // Get Coinbase Commerce API key from secrets
    const coinbaseApiKey = Deno.env.get('COINBASE_COMMERCE_API_KEY');
    if (!coinbaseApiKey) {
      throw new Error('Coinbase Commerce API key not configured');
    }

    // Create charge with Coinbase Commerce API
    const chargeData = {
      name: name,
      description: description,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amount.toString(),
        currency: currency.toUpperCase()
      },
      metadata: {
        user_id: user?.id || 'anonymous',
        user_email: user?.email || 'guest@example.com'
      }
    };

    console.log('Sending charge data to Coinbase:', chargeData);

    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': coinbaseApiKey,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify(chargeData)
    });

    const result = await response.json();
    console.log('Coinbase response:', result);

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${result.error?.message || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({
        id: result.data.id,
        hosted_url: result.data.hosted_url,
        code: result.data.code
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error creating Coinbase charge:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});