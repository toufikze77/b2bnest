import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OAuthOptions {
  provider: 'slack' | 'notion' | 'trello' | 'google_calendar';
  redirectPath: string;
  scope: string;
  authType?: 'code' | 'token';
  prompt?: string;
  accessType?: string;
  customParams?: Record<string, string>;
}

export const useOAuthConnect = () => {
  const initiateOAuth = useCallback(async ({
    provider,
    redirectPath,
    scope,
    authType = 'code',
    prompt,
    accessType,
    customParams = {},
  }: OAuthOptions) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      console.error('OAuth Error: No session found');
      return;
    }

    const token = sessionData.session.access_token;
    const uid = sessionData.session.user.id;

    const { data: config, error: configError } = await supabase.functions.invoke('get-oauth-config', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (configError || !config?.[provider]) {
      console.error(`Failed to get ${provider} client ID`, configError);
      return;
    }

    const redirectUri = encodeURIComponent(`https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/${redirectPath}`);
    const encodedScope = encodeURIComponent(scope);

    const params = new URLSearchParams({
      client_id: config[provider],
      redirect_uri: redirectUri,
      scope: encodedScope,
      response_type: authType,
      state: uid,
      ...customParams,
    });

    if (prompt) params.append('prompt', prompt);
    if (accessType) params.append('access_type', accessType);

    let oauthUrl = '';

    switch (provider) {
      case 'slack':
        oauthUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
        break;
      case 'notion':
        oauthUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&${params.toString()}`;
        break;
      case 'trello':
        oauthUrl = `https://trello.com/1/oauth2/authorize?${params.toString()}`;
        break;
      case 'google_calendar':
        oauthUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
        break;
      default:
        console.error(`OAuth provider ${provider} not supported`);
        return;
    }

    window.location.href = oauthUrl;
  }, []);

  return { initiateOAuth };
};