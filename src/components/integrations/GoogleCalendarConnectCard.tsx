'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, PlugZap, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
}

const GoogleCalendarConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, is_connected, metadata')
        .eq('user_id', userId)
        .eq('integration_name', 'google_calendar')
        .maybeSingle();

      if (!error && data?.access_token) {
        setConnected(true);
        if (data.metadata) {
          const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
          setUserEmail(metadata?.email || null);
        }
      } else {
        setConnected(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Error checking Google Calendar connection status:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user found for Google Calendar connection');
      return;
    }

    console.log('Initiating Google Calendar OAuth for user:', user.id);
    
    try {
      // Get OAuth config from edge function
      const { data: config, error } = await supabase.functions.invoke('get-oauth-config');
      
      if (error || !config?.google) {
        console.error('Failed to get Google client ID:', error);
        return;
      }
      
      const redirectUri = encodeURIComponent('https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-google-calendar');
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar');
      const state = user.id;
      
      const googleOAuthUrl = `https://accounts.google.com/oauth2/auth?client_id=${config.google}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${state}&access_type=offline&prompt=consent`;
      
      console.log('Redirecting to Google OAuth:', googleOAuthUrl);
      window.location.href = googleOAuthUrl;
    } catch (error) {
      console.error('Error initiating Google OAuth:', error);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'google_calendar');

      if (!error) {
        setConnected(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <Calendar className="w-8 h-8 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold">Google Calendar</h3>
          <p className="text-sm text-muted-foreground">
            {connected ? (userEmail ? `Connected as ${userEmail}` : 'Connected') : 'Not Connected'}
          </p>
        </div>
      </div>
      {connected ? (
        <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
          <XCircle className="mr-2 w-4 h-4" /> Disconnect
        </Button>
      ) : (
        <Button onClick={handleConnect} disabled={loading}>
          <PlugZap className="mr-2 w-4 h-4 animate-pulse" /> Connect
        </Button>
      )}
    </div>
  );
};

export default GoogleCalendarConnectCard;