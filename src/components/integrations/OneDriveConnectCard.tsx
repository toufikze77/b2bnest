import { useState, useEffect } from 'react';
import { Cloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';

interface Props {
  userId: string;
}

export default function OneDriveConnectCard({ userId }: Props) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string }>();
  const [showModal, setShowModal] = useState(false);
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('is_connected, metadata')
        .eq('user_id', userId)
        .eq('integration_name', 'onedrive')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConnected(data.is_connected);
        if (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)) {
          const meta = data.metadata as Record<string, any>;
          setUserInfo({
            name: meta.user_name as string,
            email: meta.user_email as string,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching OneDrive status:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async (credentials: { clientId: string; clientSecret: string }) => {
    setLoading(true);
    try {
      // Store credentials in user_integrations
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: userId,
          integration_name: 'onedrive',
          is_connected: false,
          metadata: {
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
          },
        });

      if (error) throw error;

      // Initiate OAuth flow
      await initiateOAuth({
        provider: 'onedrive',
        redirectPath: '/business-tools?integration=onedrive',
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });
    } catch (error) {
      console.error('Error connecting OneDrive:', error);
      toast.error('Failed to connect OneDrive');
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'onedrive');

      if (error) throw error;

      setConnected(false);
      setUserInfo(undefined);
      toast.success('OneDrive disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting OneDrive:', error);
      toast.error('Failed to disconnect OneDrive');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Cloud}
        title="Microsoft OneDrive"
        description="Sync and manage your OneDrive files and folders"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://learn.microsoft.com/en-us/onedrive/developer/"
      />
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="onedrive"
        onConnect={handleConnect}
      />
    </>
  );
}
