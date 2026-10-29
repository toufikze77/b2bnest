// Post on X (Twitter) for a Workflow Studio step. The X step is switched off for customers (verified: false in
// src/lib/workflowSteps.ts), so the app never calls this; it stays deployed and callable directly by any signed-in user.
// Phase 21: the request handling lives here with its dependencies injected (tests never call X or the database), and
// it applies the workflow plan rule (_shared/workflow-access.ts) before reading any token or posting anything.
import { createHmac } from "node:crypto";
import { COMPANY_TRIAL_ENDED_MESSAGE, SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";
import { workflowAccess, workflowRefusal, type WorkflowAccessInput } from "../_shared/workflow-access.ts";

export const corsHeaders = {
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

export async function sendTweet(
  tweetText: string, 
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<unknown> {
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


export interface Deps {
  getUser: (token: string) => Promise<{ id: string } | null>;
  /** The caller's row of public._access_state_for(uid), read with the service role. Throws if it can't be read. */
  accessState: (userId: string) => Promise<WorkflowAccessInput | null>;
  getTokens: (userId: string) => Promise<{ access_token: string; refresh_token: string }[] | null>;
  env: (name: string) => string | undefined;
  sendTweet: (text: string, apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string) => Promise<unknown>;
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {

    console.log("Workflow Twitter post function called");

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Missing authorization header')
      }
    
      const token = authHeader.replace('Bearer ', '')
      const user = await deps.getUser(token).catch(() => null)
    
      if (!user) {
        throw new Error('Unauthorized')
      }

      // Phase 21: the same plan rule as Workflow Studio (trial, owners, Business, Scale). Read on the server; a failed
      // lookup refuses (fail closed). Nothing is read from X and nothing is posted when refused.
      const access = await deps.accessState(user.id).then(workflowAccess, () => null)
      const refusal = workflowRefusal(access, { suspended: SUSPENDED_MESSAGE, trialEnded: TRIAL_ENDED_MESSAGE, companyTrialEnded: COMPANY_TRIAL_ENDED_MESSAGE })
      if (refusal) {
        console.log("Twitter post refused by the plan check", { code: refusal.code })
        return new Response(
          JSON.stringify({ success: false, code: refusal.code, error: refusal.message, message: refusal.message }),
          { status: refusal.status, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      const { text }: TwitterPostRequest = await req.json();

      if (!text || text.length === 0) {
        throw new Error("Tweet text is required");
      }

      if (text.length > 280) {
        throw new Error("Tweet text exceeds 280 characters");
      }

      // Get platform credentials
      const apiKey = deps.env("TWITTER_CONSUMER_KEY")?.trim();
      const apiSecret = deps.env("TWITTER_CONSUMER_SECRET")?.trim();

      if (!apiKey || !apiSecret) {
        throw new Error("Twitter API credentials not configured");
      }

      // Get user's Twitter tokens
      const integrationData = await deps.getTokens(user.id)
    
      if (!integrationData || integrationData.length === 0) {
        throw new Error('Twitter not connected. Please connect your Twitter account in Settings > Integrations.')
      }
    
      const accessToken = integrationData[0].access_token
      const accessTokenSecret = integrationData[0].refresh_token // Token secret stored as refresh token

      const result = await deps.sendTweet(text, apiKey, apiSecret, accessToken, accessTokenSecret);

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
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
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
}
