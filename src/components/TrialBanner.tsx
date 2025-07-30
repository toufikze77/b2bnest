import React from 'react';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TrialBanner = () => {
  const { isTrialActive, trialExpired, daysRemaining, loading } = useTrialStatus();
  const { subscribed } = useSubscription();
  const navigate = useNavigate();

  // Don't show if user has a paid subscription
  if (subscribed || loading) {
    return null;
  }

  if (trialExpired) {
    return (
      <Card className="border-red-200 bg-red-50 mb-6">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <CreditCard className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">Free Trial Expired</h3>
              <p className="text-sm text-red-700">
                Your 14-day free trial has ended. Upgrade to continue using premium features.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/pricing')}
            className="bg-red-600 hover:bg-red-700"
          >
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isTrialActive) {
    const isLowDays = daysRemaining <= 3;
    return (
      <Card className={`border-blue-200 bg-blue-50 mb-6 ${isLowDays ? 'border-orange-200 bg-orange-50' : ''}`}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isLowDays ? 'bg-orange-100' : 'bg-blue-100'}`}>
              <Clock className={`h-5 w-5 ${isLowDays ? 'text-orange-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${isLowDays ? 'text-orange-900' : 'text-blue-900'}`}>
                  Free Trial Active
                </h3>
                <Badge variant={isLowDays ? "destructive" : "secondary"}>
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                </Badge>
              </div>
              <p className={`text-sm ${isLowDays ? 'text-orange-700' : 'text-blue-700'}`}>
                {isLowDays 
                  ? 'Your trial expires soon! Upgrade to keep all your data and features.' 
                  : 'Enjoying the premium features? Upgrade anytime to continue after your trial.'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isLowDays && (
              <Button 
                onClick={() => navigate('/pricing')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            )}
            {!isLowDays && (
              <Button 
                variant="outline"
                onClick={() => navigate('/pricing')}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                View Plans
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default TrialBanner;