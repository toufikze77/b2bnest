import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OAuthOptions {
  provider: 'slack' | 'notion' | 'trello' | 'google_calendar' | 'twitter' | 'linkedin' | 'facebook';
  redirectPath?: string;
  scope?: string;
  authType?: 'code' | 'token';
  prompt?: string;
  accessType?: string;
  params?: Record<string, string>;
}

export const useOAuthConnect = () => {
  const initiateOAuth = useCallback(async (options: OAuthOptions) => {
    const { provider, redirectPath = '/settings', scope, authType = 'code', prompt, accessType, params = {} } = options;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const state = user.id;
      const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
      
      let authUrl = '';
      
      // Special handling for Twitter OAuth 1.0a
      if (provider === 'twitter') {
        const { data, error } = await supabase.functions.invoke('oauth-twitter-request', {
          body: { userId: user.id }
        });
        
        if (error) throw error;
        if (!data?.authUrl) throw new Error('Failed to get Twitter auth URL');
        
        window.location.href = data.authUrl;
        return;
      }

      // Fetch OAuth config from backend for OAuth 2.0 providers
      const { data: config, error } = await supabase.functions.invoke('get-oauth-config', {
        body: { provider }
      });

      if (error) throw error;
      if (!config) throw new Error('OAuth config not found');
      
      // Get the client ID for the provider
      const clientId = config[provider === 'google_calendar' ? 'google' : provider];
      if (!clientId) throw new Error(`Client ID not configured for ${provider}`);
      
      switch (provider) {
        case 'google_calendar': {
          const redirectUri = `${baseUrl}/oauth-google-calendar`;
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scope || 'https://www.googleapis.com/auth/calendar',
            access_type: accessType || 'offline',
            prompt: prompt || 'consent',
            state,
            ...params,
          })}`;
          break;
        }
        case 'notion': {
          const redirectUri = `${baseUrl}/oauth-notion`;
          authUrl = `https://api.notion.com/v1/oauth/authorize?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            owner: 'user',
            state,
            ...params,
          })}`;
          break;
        }
        case 'trello': {
          const redirectUri = `${baseUrl}/oauth-trello`;
          authUrl = `https://trello.com/1/authorize?${new URLSearchParams({
            return_url: redirectUri,
            callback_method: 'fragment',
            scope: scope || 'read,write',
            expiration: 'never',
            name: 'B2B Nest',
            key: clientId,
            state,
            ...params,
          })}`;
          break;
        }
        case 'slack': {
          const redirectUri = `${baseUrl}/oauth-slack`;
          authUrl = `https://slack.com/oauth/v2/authorize?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope || 'channels:read,chat:write,users:read',
            state,
            ...params,
          })}`;
          break;
        }
        case 'linkedin': {
          const redirectUri = `${baseUrl}/oauth-linkedin`;
          authUrl = `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope || 'openid profile email w_member_social',
            state,
            ...params,
          })}`;
          break;
        }
        case 'facebook': {
          const redirectUri = `${baseUrl}/oauth-facebook`;
          authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope || 'pages_manage_posts,pages_read_engagement',
            state,
            ...params,
          })}`;
          break;
        }
        default:
          throw new Error(`Provider ${provider} not supported`);
      }

      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth error:', error);
    }
  }, []);

  return { initiateOAuth };
};