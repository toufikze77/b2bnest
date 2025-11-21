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

const iCloudCalendarConnectCard = ({ userId }: Props) => {
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
        const iCloudIntegration = data.find(
          integration => integration.integration_name === 'icloud_calendar'
        );
        
        if (iCloudIntegration?.is_connected) {
          setConnected(true);
          if (iCloudIntegration.metadata) {
            const metadata = typeof iCloudIntegration.metadata === 'string' 
              ? JSON.parse(iCloudIntegration.metadata) 
              : iCloudIntegration.metadata;
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
      console.error('Error checking iCloud Calendar connection status:', error);
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
          integration_name: 'icloud_calendar',
          metadata: {
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
          },
          is_connected: false,
        });

      if (storeError) throw storeError;

      // Initiate OAuth with user's client ID
      await initiateOAuth({
        provider: 'icloud_calendar',
        redirectPath: '/business-tools?integration=icloud_calendar',
        scope: 'https://www.icloud.com/calendar',
        clientId: credentials.client_id,
      });
      
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect iCloud Calendar');
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
        .eq('integration_name', 'icloud_calendar');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('iCloud Calendar disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting iCloud Calendar:', error);
      toast.error('Failed to disconnect iCloud Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Calendar}
        title="iCloud Calendar"
        description="Connect your iCloud Calendar to sync events and manage Apple calendar schedules"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://developer.apple.com/documentation/sign_in_with_apple"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="icloud_calendar"
        onConnect={handleConnect}
      />
    </>
  );
};

export default iCloudCalendarConnectCard;
