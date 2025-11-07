import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { hmrcService } from '@/services/hmrcService';

export const useHMRCCallback = () => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const isCallback = urlParams.get('hmrc-callback');

      if (!code || !state || !isCallback) {
        return;
      }

      setProcessing(true);
      
      try {
        await hmrcService.handleOAuthCallback(code, state);
        
        toast({
          title: "HMRC Connected",
          description: "Successfully authenticated with HMRC Government Gateway.",
        });

        // Clean up URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('code');
        newUrl.searchParams.delete('state');
        newUrl.searchParams.delete('hmrc-callback');
        window.history.replaceState({}, '', newUrl);
        
        // Refresh page to show connected state
        window.location.reload();
      } catch (error) {
        console.error('HMRC callback error:', error);
        toast({
          title: "Connection Failed",
          description: error instanceof Error ? error.message : "Failed to complete HMRC authentication.",
          variant: "destructive",
        });
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [toast]);

  return { processing };
};
