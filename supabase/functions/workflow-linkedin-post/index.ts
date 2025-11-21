import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LinkedInPostRequest {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  workflowId?: string;
}

async function getUserProfile(accessToken: string): Promise<string> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })
  
  const data = await response.json()
  return data.sub // LinkedIn user ID
}

async function postToLinkedIn(text: string, visibility: string, accessToken: string, userId: string): Promise<any> {
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

const handler = async (req: Request): Promise<Response> => {
  console.log("Workflow LinkedIn post function called");

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

    const { text, visibility = 'PUBLIC' }: LinkedInPostRequest = await req.json();

    if (!text || text.length === 0) {
      throw new Error("Post text is required");
    }

    // Get user's LinkedIn token
    const { data: integrationData } = await supabase.rpc('get_integration_tokens', {
      p_integration_name: 'linkedin',
      p_user_id: user.id
    })
    
    if (!integrationData || integrationData.length === 0) {
      throw new Error('LinkedIn not connected. Please connect your LinkedIn account in Settings > Integrations.')
    }
    
    const accessToken = integrationData[0].access_token
    
    // Get LinkedIn user ID
    const linkedInUserId = await getUserProfile(accessToken)

    const result = await postToLinkedIn(text, visibility, accessToken, linkedInUserId);

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
  } catch (error: any) {
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

serve(handler);
