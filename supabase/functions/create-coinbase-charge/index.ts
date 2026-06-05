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
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = userData.user;

    const { amount, currency, name, description } = await req.json();

    // Validate inputs
    const allowedCurrencies = new Set(['USD', 'EUR', 'GBP']);
    const normalizedCurrency = typeof currency === 'string' ? currency.toUpperCase() : '';
    if (!allowedCurrencies.has(normalizedCurrency)) {
      return new Response(JSON.stringify({ error: 'Invalid currency' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 100000) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const safeName = typeof name === 'string' ? name.slice(0, 200) : 'Purchase';
    const safeDescription = typeof description === 'string' ? description.slice(0, 500) : '';

    // Get Coinbase Commerce API key from secrets
    const coinbaseApiKey = Deno.env.get('COINBASE_COMMERCE_API_KEY');
    if (!coinbaseApiKey) {
      throw new Error('Coinbase Commerce API key not configured');
    }

    const chargeData = {
      name: safeName,
      description: safeDescription,
      pricing_type: 'fixed_price',
      local_price: {
        amount: numericAmount.toFixed(2),
        currency: normalizedCurrency,
      },
      metadata: {
        user_id: user.id,
        user_email: user.email,
      },
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