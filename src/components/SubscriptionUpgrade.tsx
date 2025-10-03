import React from 'react';
import PricingPlans from '@/components/PricingPlans';

interface SubscriptionUpgradeProps {
  featureName: string;
  onUpgrade?: () => void;
}

const SubscriptionUpgrade = ({ featureName, onUpgrade }: SubscriptionUpgradeProps) => {
  return <PricingPlans />;
};

export default SubscriptionUpgrade;
