// Post on LinkedIn for a Workflow Studio step. The LinkedIn step is switched off for customers (verified: false in
// src/lib/workflowSteps.ts), so the app never calls this; it stays deployed and callable directly by any signed-in user.
// Phase 21: the request handling lives here with its dependencies injected (tests never call LinkedIn or the
// database), and it applies the workflow plan rule (_shared/workflow-access.ts) before reading any token or posting.
import { COMPANY_TRIAL_ENDED_MESSAGE, SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";
import { workflowAccess, workflowRefusal, type WorkflowAccessInput } from "../_shared/workflow-access.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LinkedInPostRequest {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  workflowId?: string;
}

export async function getUserProfile(accessToken: string): Promise<string> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })
  
  const data = await response.json()
  return data.sub // LinkedIn user ID
}

export async function postToLinkedIn(text: string, visibility: string, accessToken: string, userId: string): Promise<unknown> {
  const url = "https://api.linkedin.com/v2/ugcPosts";

  const postData = {
    author: `urn:li:person:${userId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: text
        },
        shareMediaCategory: "NONE"
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility
    }
  };

  console.log("Posting to LinkedIn API");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify(postData)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`LinkedIn API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

export interface Deps {
  getUser: (token: string) => Promise<{ id: string } | null>;
  /** The caller's row of public._access_state_for(uid), read with the service role. Throws if it can't be read. */
  accessState: (userId: string) => Promise<WorkflowAccessInput | null>;
  getTokens: (userId: string) => Promise<{ access_token: string }[] | null>;
  getUserProfile: (accessToken: string) => Promise<string>;
  postToLinkedIn: (text: string, visibility: string, accessToken: string, userId: string) => Promise<unknown>;
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {

    console.log("Workflow LinkedIn post function called");

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
      // lookup refuses (fail closed). Nothing is read from LinkedIn and nothing is posted when refused.
      const access = await deps.accessState(user.id).then(workflowAccess, () => null)
      const refusal = workflowRefusal(access, { suspended: SUSPENDED_MESSAGE, trialEnded: TRIAL_ENDED_MESSAGE, companyTrialEnded: COMPANY_TRIAL_ENDED_MESSAGE })
      if (refusal) {
        console.log("LinkedIn post refused by the plan check", { code: refusal.code })
        return new Response(
          JSON.stringify({ success: false, code: refusal.code, error: refusal.message, message: refusal.message }),
          { status: refusal.status, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      const { text, visibility = 'PUBLIC' }: LinkedInPostRequest = await req.json();

      if (!text || text.length === 0) {
        throw new Error("Post text is required");
      }

      // Get user's LinkedIn token
      const integrationData = await deps.getTokens(user.id)
    
      if (!integrationData || integrationData.length === 0) {
        throw new Error('LinkedIn not connected. Please connect your LinkedIn account in Settings > Integrations.')
      }
    
      const accessToken = integrationData[0].access_token
    
      // Get LinkedIn user ID
      const linkedInUserId = await deps.getUserProfile(accessToken)

      const result = await deps.postToLinkedIn(text, visibility, accessToken, linkedInUserId);

      console.log("LinkedIn post created successfully:", result);

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          message: "LinkedIn post created successfully"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Error posting to LinkedIn:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          message: "Failed to create LinkedIn post"
        }),
        {
          status: error.message.includes('not connected') ? 403 : 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  };
}
