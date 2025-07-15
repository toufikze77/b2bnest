import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrueLayerProvider {
  provider_id: string;
  display_name: string;
  logo_uri: string;
  bg_color: string;
  max_historical_days: number;
}

interface TrueLayerAccount {
  account_id: string;
  provider: {
    provider_id: string;
    display_name: string;
  };
  account_type: string;
  display_name: string;
  currency: string;
  account_number?: {
    number: string;
    sort_code: string;
  };
  balance: {
    current: number;
    available: number;
  };
}

interface TrueLayerTransaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: string;
  transaction_category: string;
  merchant_name?: string;
  running_balance?: {
    amount: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const TRUELAYER_CLIENT_ID = Deno.env.get('TRUELAYER_CLIENT_ID');
    const TRUELAYER_CLIENT_SECRET = Deno.env.get('TRUELAYER_CLIENT_SECRET');
    const TRUELAYER_BASE_URL = 'https://api.truelayer-sandbox.com';

    if (!TRUELAYER_CLIENT_ID || !TRUELAYER_CLIENT_SECRET) {
      throw new Error('TrueLayer credentials not configured');
    }

    switch (action) {
      case 'get-providers': {
        console.log('Fetching TrueLayer providers...');
        
        // Get access token first
        const tokenResponse = await fetch(`${TRUELAYER_BASE_URL}/connect/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: TRUELAYER_CLIENT_ID,
            client_secret: TRUELAYER_CLIENT_SECRET,
            scope: 'info accounts balance transactions'
          })
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token request failed: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get providers
        const providersResponse = await fetch(`${TRUELAYER_BASE_URL}/data/v1/providers`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });

        if (!providersResponse.ok) {
          throw new Error(`Providers request failed: ${providersResponse.statusText}`);
        }

        const providersData = await providersResponse.json();
        
        return new Response(JSON.stringify({ providers: providersData.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-auth-url': {
        const { provider_id } = await req.json();
        
        const authUrl = `${TRUELAYER_BASE_URL}/connect/token?` + new URLSearchParams({
          response_type: 'code',
          client_id: TRUELAYER_CLIENT_ID,
          scope: 'info accounts balance transactions',
          redirect_uri: `${req.headers.get('origin')}/business-tools?bank_connected=true`,
          providers: provider_id,
          enable_mock: 'true', // Enable sandbox mock data
          disable_providers: 'false'
        });

        return new Response(JSON.stringify({ auth_url: authUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'exchange-code': {
        const { code } = await req.json();
        
        console.log('Exchanging authorization code for access token...');
        
        const tokenResponse = await fetch(`${TRUELAYER_BASE_URL}/connect/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: TRUELAYER_CLIENT_ID,
            client_secret: TRUELAYER_CLIENT_SECRET,
            code: code,
            redirect_uri: `${req.headers.get('origin')}/business-tools?bank_connected=true`
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get accounts
        const accountsResponse = await fetch(`${TRUELAYER_BASE_URL}/data/v1/accounts`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });

        if (!accountsResponse.ok) {
          throw new Error(`Accounts request failed: ${accountsResponse.statusText}`);
        }

        const accountsData = await accountsResponse.json();
        
        // Store accounts in database
        for (const account of accountsData.results) {
          const { error: insertError } = await supabaseClient
            .from('bank_accounts')
            .upsert({
              user_id: user.id,
              account_id: account.account_id,
              provider_id: account.provider.provider_id,
              provider_name: account.provider.display_name,
              account_type: account.account_type,
              account_number: account.account_number?.number || null,
              sort_code: account.account_number?.sort_code || null,
              currency: account.currency,
              balance: account.balance.current,
              available_balance: account.balance.available,
              last_synced_at: new Date().toISOString(),
            }, {
              onConflict: 'account_id,user_id'
            });

          if (insertError) {
            console.error('Error storing account:', insertError);
          }

          // Fetch and store transactions
          const transactionsResponse = await fetch(`${TRUELAYER_BASE_URL}/data/v1/accounts/${account.account_id}/transactions`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          });

          if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            
            for (const transaction of transactionsData.results) {
              const { error: txError } = await supabaseClient
                .from('bank_transactions')
                .upsert({
                  user_id: user.id,
                  bank_account_id: (await supabaseClient
                    .from('bank_accounts')
                    .select('id')
                    .eq('account_id', account.account_id)
                    .eq('user_id', user.id)
                    .single()).data?.id,
                  transaction_id: transaction.transaction_id,
                  amount: transaction.amount,
                  currency: transaction.currency,
                  description: transaction.description,
                  transaction_type: transaction.transaction_type,
                  category: transaction.transaction_category,
                  merchant_name: transaction.merchant_name || null,
                  transaction_date: new Date(transaction.timestamp).toISOString().split('T')[0],
                  timestamp: transaction.timestamp,
                  balance_after: transaction.running_balance?.amount || null,
                }, {
                  onConflict: 'transaction_id,bank_account_id'
                });

              if (txError) {
                console.error('Error storing transaction:', txError);
              }
            }
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          accounts: accountsData.results.length 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync-accounts': {
        console.log('Syncing bank accounts and transactions...');
        
        // Get stored accounts for user
        const { data: accounts, error: accountsError } = await supabaseClient
          .from('bank_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (accountsError) {
          throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
        }

        // For demo purposes, simulate transaction updates
        let totalSynced = 0;
        for (const account of accounts || []) {
          // Update last_synced_at
          await supabaseClient
            .from('bank_accounts')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', account.id);
          
          totalSynced++;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          synced_accounts: totalSynced 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('TrueLayer integration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});