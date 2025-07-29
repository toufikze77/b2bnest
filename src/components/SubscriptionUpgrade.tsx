import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Sparkles } from "lucide-react";
import CheckoutModal from "@/components/checkout/CheckoutModal";

interface SubscriptionUpgradeProps {
  featureName: string;
  onUpgrade?: () => void;
}

const SubscriptionUpgrade = ({ featureName, onUpgrade }: SubscriptionUpgradeProps) => {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handlePaymentSuccess = () => {
    setIsCheckoutOpen(false);
    onUpgrade?.();
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto border-2 border-dashed border-gray-300">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-gray-900">
            Upgrade to Premium
          </CardTitle>
          <CardDescription className="text-lg">
            Unlock <span className="font-semibold text-blue-600">{featureName}</span> and all AI Studio features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Free Plan</CardTitle>
                  <Badge variant="secondary">Current</Badge>
                </div>
                <CardDescription>Perfect for getting started</CardDescription>
                <div className="text-2xl font-bold">£0<span className="text-sm font-normal">/month</span></div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">AI Business Advisor</span>
                  </li>
                  <li className="flex items-center text-gray-400">
                    <div className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm line-through">Intelligent Analytics</span>
                  </li>
                  <li className="flex items-center text-gray-400">
                    <div className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm line-through">Workflow Builder</span>
                  </li>
                  <li className="flex items-center text-gray-400">
                    <div className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm line-through">Smart Personalization</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="relative border-2 border-blue-500 shadow-lg">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Recommended
                </Badge>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Premium Plan</CardTitle>
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <CardDescription>Full access to AI Studio</CardDescription>
                <div className="flex items-center justify-center gap-2">
                  <div className="text-2xl font-bold">£11<span className="text-sm font-normal">/month</span></div>
                  <span className="text-sm text-gray-400 line-through">£39</span>
                </div>
                <Badge className="mt-2 bg-red-100 text-red-800">
                  Limited Time: 72% OFF
                </Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm font-semibold">Everything in Free</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">Intelligent Analytics</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">Workflow Builder</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">Smart Personalization</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">Priority Support</span>
                  </li>
                </ul>
                <Button 
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={() => setIsCheckoutOpen(true)}
                >
                  Upgrade Now
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-gray-500">
            Cancel anytime • Secure payment • Instant access
          </div>
        </CardContent>
      </Card>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        amount={11}
        currency="GBP"
        itemName="AI Studio Premium Subscription"
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
};

export default SubscriptionUpgrade;