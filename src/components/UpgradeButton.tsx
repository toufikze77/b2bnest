import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useSubscription } from '@/hooks/useSubscription';

interface UpgradeButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'floating';
  size?: 'sm' | 'default' | 'lg';
  location?: string;
  className?: string;
}

const UpgradeButton = ({ 
  variant = 'default', 
  size = 'default',
  location = 'general',
  className = ''
}: UpgradeButtonProps) => {
  const navigate = useNavigate();
  const { trialExpired, isTrialActive, daysRemaining } = useTrialStatus();
  const { subscribed } = useSubscription();

  // Don't show if user has a paid subscription
  if (subscribed) {
    return null;
  }

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleUpgrade}
          className={`
            bg-gradient-to-r from-blue-600 to-purple-600 
            hover:from-blue-700 hover:to-purple-700 
            text-white font-semibold shadow-lg hover:shadow-xl 
            transform hover:scale-105 transition-all duration-300
            ${className}
          `}
          size={size}
        >
          <Crown className="h-4 w-4 mr-2" />
          {trialExpired ? 'Upgrade Now' : 'Start Free Trial'}
        </Button>
      </div>
    );
  }

  if (trialExpired) {
    return (
      <Button
        onClick={handleUpgrade}
        variant={variant}
        size={size}
        className={`
          bg-red-600 hover:bg-red-700 text-white
          ${className}
        `}
      >
        <Zap className="h-4 w-4 mr-2" />
        Upgrade Required
      </Button>
    );
  }

  if (isTrialActive && daysRemaining <= 3) {
    return (
      <Button
        onClick={handleUpgrade}
        variant={variant}
        size={size}
        className={`
          bg-orange-600 hover:bg-orange-700 text-white
          ${className}
        `}
      >
        <Crown className="h-4 w-4 mr-2" />
        Upgrade Before Trial Ends
      </Button>
    );
  }

  return (
    <Button
      onClick={handleUpgrade}
      variant={variant}
      size={size}
      className={`
        bg-gradient-to-r from-blue-600 to-purple-600 
        hover:from-blue-700 hover:to-purple-700 
        text-white font-semibold
        ${className}
      `}
    >
      <ArrowRight className="h-4 w-4 mr-2" />
      Start Free Trial
    </Button>
  );
};

export default UpgradeButton;