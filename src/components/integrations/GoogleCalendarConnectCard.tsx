import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const GoogleCalendarConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
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

  const handleConnect = async () => {
    setLoading(true);
    try {
      await initiateOAuth({
        provider: 'google_calendar',
        redirectPath: '/business-tools?integration=google_calendar',
        scope: 'https://www.googleapis.com/auth/calendar',
        prompt: 'consent',
        accessType: 'offline',
      });
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Google Calendar');
    } finally {
      setLoading(false);
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
        description="Connect your Google Calendar to sync events and manage schedules"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://developers.google.com/calendar"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="google_calendar"
        onConnect={handleConnect}
      />
    </>
  );
};

export default GoogleCalendarConnectCard;
