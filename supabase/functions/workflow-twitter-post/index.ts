import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TwitterPostRequest {
  text: string;
  workflowId?: string;
}

function validateEnvironmentVariables() {
  const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
  const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
  const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
  const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

  if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    throw new Error("Missing Twitter API credentials. Please set TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET");
  }

  return { API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_TOKEN_SECRET };
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

async function sendTweet(tweetText: string, credentials: any): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const method = "POST";

  const oauthHeader = generateOAuthHeader(
    method,
    url,
    credentials.API_KEY,
    credentials.API_SECRET,
    credentials.ACCESS_TOKEN,
    credentials.ACCESS_TOKEN_SECRET
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
    const { text }: TwitterPostRequest = await req.json();

    if (!text || text.length === 0) {
      throw new Error("Tweet text is required");
    }

    if (text.length > 280) {
      throw new Error("Tweet text exceeds 280 characters");
    }

    const credentials = validateEnvironmentVariables();
    const result = await sendTweet(text, credentials);

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
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
