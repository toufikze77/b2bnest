import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LinkedInPostRequest {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  workflowId?: string;
}

async function postToLinkedIn(text: string, visibility: string, accessToken: string): Promise<any> {
  const url = "https://api.linkedin.com/v2/ugcPosts";

  const postData = {
    author: "urn:li:person:AUTHOR_ID", // This needs to be set with actual user ID
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
    const { text, visibility = 'PUBLIC' }: LinkedInPostRequest = await req.json();

    if (!text || text.length === 0) {
      throw new Error("Post text is required");
    }

    const accessToken = Deno.env.get("LINKEDIN_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("LinkedIn access token not configured. Please set LINKEDIN_ACCESS_TOKEN secret.");
    }

    const result = await postToLinkedIn(text, visibility, accessToken);

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
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
