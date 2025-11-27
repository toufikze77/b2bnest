import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Purchase {
  id: string;
  name: string;
  plan: string;
  price: number;
  timestamp: Date;
  isTrial?: boolean;
}

const LivePurchaseNotification = () => {
  const [currentPurchase, setCurrentPurchase] = useState<Purchase | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);

  // Fetch real purchases from database
  useEffect(() => {
    const fetchRecentPurchases = async () => {
      try {
        // Get subscriptions from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: subscribers, error } = await supabase
          .from('subscribers')
          .select('id, email, subscription_tier, created_at, user_id')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching purchases:', error);
          return;
        }

        // Get profile data for display names
        const userIds = subscribers?.map(s => s.user_id).filter(Boolean) || [];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, display_name')
          .in('id', userIds);

        const profileMap = new Map(
          profiles?.map(p => [p.id, p.display_name || 'Anonymous']) || []
        );

        // Map to Purchase format
        const purchases: Purchase[] = (subscribers || []).map(sub => {
          const displayName = sub.user_id ? profileMap.get(sub.user_id) : null;
          const emailName = sub.email?.split('@')[0] || 'User';
          const name = displayName || emailName.charAt(0).toUpperCase() + emailName.slice(1);
          
          // Determine if it's a trial (free tier) or paid subscription
          const isTrial = !sub.subscription_tier || sub.subscription_tier === 'free';
          const planName = isTrial ? 'Free Trial' : sub.subscription_tier || 'Starter';
          
          // Map tier to price
          const priceMap: Record<string, number> = {
            'starter': 11,
            'professional': 19,
            'enterprise': 29,
            'free': 0
          };
          
          const price = priceMap[sub.subscription_tier?.toLowerCase() || 'free'] || 0;

          return {
            id: sub.id,
            name: name.length > 15 ? name.substring(0, 15) + '.' : name,
            plan: planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase(),
            price,
            timestamp: new Date(sub.created_at),
            isTrial
          };
        });

        setRecentPurchases(purchases);
      } catch (error) {
        console.error('Error fetching purchases:', error);
      }
    };

    fetchRecentPurchases();
    
    // Refresh every 5 minutes to get new purchases
    const refreshInterval = setInterval(fetchRecentPurchases, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (recentPurchases.length === 0) return;

    const showRandomPurchase = () => {
      const randomPurchase = recentPurchases[Math.floor(Math.random() * recentPurchases.length)];
      setCurrentPurchase(randomPurchase);
      setIsVisible(true);

      // Hide after 5 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };

    // Show first notification after 3 seconds
    const initialTimeout = setTimeout(showRandomPurchase, 3000);

    // Then show every 8-15 seconds
    const interval = setInterval(() => {
      const randomDelay = Math.random() * 7000 + 8000; // 8-15 seconds
      setTimeout(showRandomPurchase, randomDelay);
    }, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [recentPurchases]);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!currentPurchase || !isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left duration-500">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-green-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              <span className="font-semibold">{currentPurchase.name}</span> just {currentPurchase.isTrial ? 'started' : 'purchased'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {currentPurchase.plan}
              </Badge>
              {currentPurchase.price > 0 && (
                <span className="text-sm font-semibold text-green-600">
                  £{currentPurchase.price}/month
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleTimeString()} • {currentPurchase.isTrial ? 'Join the community' : 'Limited time offer'}
            </p>
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivePurchaseNotification;