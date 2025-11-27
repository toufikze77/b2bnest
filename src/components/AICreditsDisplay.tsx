import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface AICreditsInfo {
  credits_remaining: number;
  credits_limit: number;
  reset_date: string;
  subscription_tier: string;
}

const AICreditsDisplay = () => {
  const { user } = useAuth();
  const [creditsInfo, setCreditsInfo] = useState<AICreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCreditsInfo();
    }
  }, [user]);

  const fetchCreditsInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('get_ai_credits_info');
      
      if (error) throw error;
      
      setCreditsInfo(data as unknown as AICreditsInfo);
    } catch (error: any) {
      console.error('Error fetching AI credits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI credits information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) return null;

  if (!creditsInfo) return null;

  const percentage = (creditsInfo.credits_remaining / creditsInfo.credits_limit) * 100;
  const resetDate = new Date(creditsInfo.reset_date).toLocaleDateString();
  const isLow = percentage < 20;
  const isCritical = percentage < 10;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Credits</h3>
              <p className="text-xs text-gray-500">Resets on {resetDate}</p>
            </div>
          </div>
          <Badge 
            variant={isCritical ? 'destructive' : isLow ? 'secondary' : 'default'}
            className="text-xs"
          >
            {creditsInfo.subscription_tier}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Remaining</span>
            <span className="font-semibold text-gray-900">
              {creditsInfo.credits_remaining} / {creditsInfo.credits_limit}
            </span>
          </div>
          
          <Progress 
            value={percentage} 
            className={`h-2 ${
              isCritical ? 'bg-red-200' : isLow ? 'bg-yellow-200' : 'bg-blue-200'
            }`}
          />

          {isLow && (
            <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <TrendingUp className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-800">
                <p className="font-semibold">Running low on credits!</p>
                <p>Upgrade your plan for more AI conversations.</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AICreditsDisplay;