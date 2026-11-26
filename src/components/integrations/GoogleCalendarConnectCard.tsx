import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { SyncToCalendarButton } from '@/components/IntegrationButtons';
import { forgetCalendarLinks, GOOGLE_CALENDAR_DESCRIPTION, GOOGLE_CALENDAR_SCOPE, GOOGLE_NOT_SET_UP, resetCalendarConnectionCache } from '@/lib/calendarSync';

interface Props {
  userId: string;
}

const GoogleCalendarConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_integrations_safe', { p_user_id: userId });

      if (!error && data) {
        const googleCalendarIntegration = data.find(
          integration => integration.integration_name === 'google_calendar'
        );
        
        if (googleCalendarIntegration?.is_connected) {
          setConnected(true);
          if (googleCalendarIntegration.metadata) {
            const metadata = typeof googleCalendarIntegration.metadata === 'string' 
              ? JSON.parse(googleCalendarIntegration.metadata) 
              : googleCalendarIntegration.metadata;
            setUserInfo({ email: metadata?.email, name: metadata?.name });
          }
        } else {
          setConnected(false);
          setUserInfo(null);
        }
      } else {
        setConnected(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error checking Google Calendar connection status:', error);
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  // B2BNEST's own Google app: the person only clicks Connect and approves at Google (no Client ID or Secret to type).
  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data: config, error } = await supabase.functions.invoke('get-oauth-config', { body: { provider: 'google' } });
      const clientId = !error && typeof config?.clientId === 'string' ? config.clientId : '';
      if (!clientId) {
        toast.error(GOOGLE_NOT_SET_UP);
        return;
      }
      resetCalendarConnectionCache();
      await initiateOAuth({
        provider: 'google_calendar',
        redirectPath: '/business-tools?integration=google_calendar',
        scope: GOOGLE_CALENDAR_SCOPE,
        prompt: 'consent',
        accessType: 'offline',
        clientId,
      });
    } catch (error) {
      console.error('Error starting the Google Calendar connection:', error);
      toast.error('Could not start the connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      // Forget which Google event belongs to which task; the events themselves stay in Google Calendar.
      await forgetCalendarLinks();
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'google_calendar');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('Google Calendar disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Calendar}
        title="Google Calendar"
        description={GOOGLE_CALENDAR_DESCRIPTION}
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => { void handleConnect(); }}
        onDisconnect={handleDisconnect}
        docsUrl="https://developers.google.com/calendar"
        extra={<SyncToCalendarButton onReconnectNeeded={() => { resetCalendarConnectionCache(); void fetchStatus(); }} />}
      />

    </>
  );
};

export default GoogleCalendarConnectCard;
