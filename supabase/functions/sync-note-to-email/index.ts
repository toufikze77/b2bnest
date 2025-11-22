import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, provider, noteId, content } = await req.json();

    if (!userId || !provider || !content) {
      throw new Error('Missing required parameters');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get integration tokens
    const { data: integration, error: fetchError } = await supabaseClient
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('integration_name', provider)
      .eq('is_connected', true)
      .single();

    if (fetchError || !integration) {
      throw new Error(`${provider} not connected`);
    }

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    
    let accessToken = integration.access_token;

    if (expiresAt <= now && integration.refresh_token) {
      // Refresh token logic would go here
      // For now, we'll use the existing token
      console.log('Token refresh needed but not implemented yet');
    }

    // Create draft based on provider
    if (provider === 'gmail') {
      await createGmailDraft(accessToken, content);
    } else if (provider === 'outlook') {
      await createOutlookDraft(accessToken, content);
    } else {
      throw new Error('Unsupported provider');
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function createGmailDraft(accessToken: string, content: string) {
  // Create email message
  const email = [
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    'Subject: Note from NotePro',
    '',
    content,
  ].join('\n');

  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        raw: encodedEmail,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gmail draft creation failed:', error);
    throw new Error('Failed to create Gmail draft');
  }

  return await response.json();
}

async function createOutlookDraft(accessToken: string, content: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: 'Note from NotePro',
      body: {
        contentType: 'HTML',
        content: content,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Outlook draft creation failed:', error);
    throw new Error('Failed to create Outlook draft');
  }

  return await response.json();
}
