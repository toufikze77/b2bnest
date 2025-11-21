import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHmac } from "node:crypto";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TwitterPostRequest {
  text: string;
  workflowId?: string;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");

  console.log("Generated OAuth signature for Twitter API");
  return signature;
}

function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) => a[0].localeCompare(b[0]));

  return "OAuth " + entries.map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}

async function sendTweet(
  tweetText: string, 
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const method = "POST";

  const oauthHeader = generateOAuthHeader(
    method,
    url,
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret
  );

  console.log("Sending tweet to Twitter API");

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Workflow Twitter post function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { text }: TwitterPostRequest = await req.json();

    if (!text || text.length === 0) {
      throw new Error("Tweet text is required");
    }

    if (text.length > 280) {
      throw new Error("Tweet text exceeds 280 characters");
    }

    // Get platform credentials
    const apiKey = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
    const apiSecret = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();

    if (!apiKey || !apiSecret) {
      throw new Error("Twitter API credentials not configured");
    }

    // Get user's Twitter tokens
    const { data: integrationData } = await supabase.rpc('get_integration_tokens', {
      p_integration_name: 'twitter',
      p_user_id: user.id
    })
    
    if (!integrationData || integrationData.length === 0) {
      throw new Error('Twitter not connected. Please connect your Twitter account in Settings > Integrations.')
    }
    
    const accessToken = integrationData[0].access_token
    const accessTokenSecret = integrationData[0].refresh_token // Token secret stored as refresh token

    const result = await sendTweet(text, apiKey, apiSecret, accessToken, accessTokenSecret);

    console.log("Tweet posted successfully:", result);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        message: "Tweet posted successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error posting tweet:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: "Failed to post tweet"
      }),
      {
        status: error.message.includes('not connected') ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
