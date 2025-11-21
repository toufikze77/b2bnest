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

const OutlookCalendarConnectCard = ({ userId }: Props) => {
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
        const outlookIntegration = data.find(
          integration => integration.integration_name === 'outlook_calendar'
        );
        
        if (outlookIntegration?.is_connected) {
          setConnected(true);
          if (outlookIntegration.metadata) {
            const metadata = typeof outlookIntegration.metadata === 'string' 
              ? JSON.parse(outlookIntegration.metadata) 
              : outlookIntegration.metadata;
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
      console.error('Error checking Outlook Calendar connection status:', error);
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async (credentials?: Record<string, string>) => {
    if (!credentials?.client_id || !credentials?.client_secret) {
      toast.error('Please provide both Client ID and Client Secret');
      return;
    }

    setLoading(true);
    try {
      // Store credentials first
      const { error: storeError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: userId,
          integration_name: 'outlook_calendar',
          metadata: {
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
          },
          is_connected: false,
        });

      if (storeError) throw storeError;

      // Initiate OAuth with user's client ID
      await initiateOAuth({
        provider: 'outlook_calendar',
        redirectPath: '/business-tools?integration=outlook_calendar',
        scope: 'Calendars.ReadWrite offline_access',
        clientId: credentials.client_id,
      });
      
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Outlook Calendar');
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
        .eq('integration_name', 'outlook_calendar');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('Outlook Calendar disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Outlook Calendar:', error);
      toast.error('Failed to disconnect Outlook Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Calendar}
        title="Outlook Calendar"
        description="Connect your Microsoft Outlook 365 Calendar to sync events and manage schedules"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://learn.microsoft.com/en-us/graph/api/resources/calendar"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="outlook_calendar"
        onConnect={handleConnect}
      />
    </>
  );
};

export default OutlookCalendarConnectCard;
