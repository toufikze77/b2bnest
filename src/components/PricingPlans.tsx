import React, { useState } from 'react';
import { Check, Zap, Crown, Building2, Sparkles, Users, TrendingUp, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/components/ui/use-toast';
import SubscriptionUpgrade from '@/components/SubscriptionUpgrade';

const PricingPlans = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const { user } = useAuth();
  const { isPremium, subscription_tier } = useSubscription();

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for solopreneurs and small teams',
      icon: Zap,
      color: 'from-blue-500 to-cyan-500',
      monthly: 19,
      annual: 15, // 20% discount
      userLimit: '1 user',
      features: [
        'AI Business Advisor',
        'Basic document templates',
        '5 AI conversations/month',
        'Email support',
        'Mobile app access',
      ],
      cta: 'Buy now',
      popular: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For growing teams and serious entrepreneurs',
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
      monthly: 49,
      annual: 39, // 20% discount
      userLimit: '5 users',
      features: [
        'Everything in Starter',
        'Advanced AI Studio features',
        'Unlimited AI conversations',
        'Premium document templates',
        'CRM & Project Management',
        'Invoice & Quote generator',
        'Priority support',
        'Team collaboration tools',
        'Custom integrations',
      ],
      cta: 'Buy now',
      popular: true,
      savings: '20% off',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For scaling businesses and larger teams',
      icon: Building2,
      color: 'from-emerald-500 to-teal-500',
      monthly: 99,
      annual: 79, // 20% discount
      userLimit: '25 users',
      features: [
        'Everything in Professional',
        'Advanced analytics & insights',
        'Custom AI workflows',
        'White-label solutions',
        'Dedicated account manager',
        'Custom integrations & API',
        'Advanced security controls',
        'Training & onboarding',
        'SLA guarantee',
      ],
      cta: 'Buy now',
      popular: false,
      savings: '20% off',
    },
  ];

  const handlePlanSelect = (planId: string) => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to purchase a plan.",
        variant: "destructive"
      });
      window.location.href = '/auth';
      return;
    }

    if (planId === 'starter') {
      toast({
        title: "Free Plan",
        description: "You're already on the starter plan. All features are available to you.",
      });
      return; // Free plan, no action needed
    }

    setSelectedPlan(planId);
    setShowUpgrade(true);
  };

  const getCurrentPlanBadge = (planId: string) => {
    if (!isPremium && planId === 'starter') {
      return <Badge className="absolute -top-1 -right-2 bg-green-500">Current Plan</Badge>;
    }
    if (isPremium && subscription_tier === 'Professional' && planId === 'professional') {
      return <Badge className="absolute -top-1 -right-2 bg-green-500">Current Plan</Badge>;
    }
    if (isPremium && subscription_tier === 'Enterprise' && planId === 'enterprise') {
      return <Badge className="absolute -top-1 -right-2 bg-green-500">Current Plan</Badge>;
    }
    return null;
  };

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h2 className="text-4xl font-bold text-gray-900">
              Simple, Transparent Pricing
            </h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Join 8,200+ businesses already scaling with our AI-powered platform. 
            Choose the plan that fits your growth stage.
          </p>
          
          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-lg font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className={`text-lg font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge className="bg-green-100 text-green-800 ml-2">
                Save 20%
              </Badge>
            )}
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500 mb-12">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>8,200+ businesses</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>180% YoY growth</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>SOC 2 compliant</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {plans.map((plan) => {
            const PlanIcon = plan.icon;
            const price = isAnnual ? plan.annual : plan.monthly;
            const originalPrice = plan.monthly;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  plan.popular 
                    ? 'border-2 border-blue-500 shadow-xl' 
                    : 'border border-gray-200 hover:border-blue-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-1 text-sm font-semibold">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                {getCurrentPlanBadge(plan.id)}

                <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
                
                <CardHeader className="text-center pb-6">
                  <div className={`mx-auto w-16 h-16 bg-gradient-to-r ${plan.color} rounded-full flex items-center justify-center mb-4`}>
                    <PlanIcon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {plan.description}
                  </CardDescription>
                  
                  {/* Pricing */}
                  <div className="mt-6">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold text-gray-900">
                        £{price}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-500">/month</span>
                        {isAnnual && plan.monthly > 0 && (
                          <span className="text-xs text-gray-400 line-through">
                            £{originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAnnual && plan.savings && (
                      <Badge className="mt-2 bg-green-100 text-green-800">
                        {plan.savings}
                      </Badge>
                    )}
                    <p className="text-sm text-gray-500 mt-2">{plan.userLimit}</p>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button 
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`w-full mb-6 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                        : plan.id === 'enterprise'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                        : 'bg-gray-900 hover:bg-gray-800'
                    } text-white font-semibold py-3`}
                  >
                    {plan.cta}
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h4 className="font-semibold text-gray-900 mb-2">
                Can I change plans anytime?
              </h4>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h4>
              <p className="text-gray-600">
                All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h4>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and bank transfers for annual plans.
              </p>
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-gray-900 mb-2">
                Do you offer discounts for nonprofits?
              </h4>
              <p className="text-gray-600">
                Yes! We offer 50% off all plans for verified nonprofit organizations.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">
              Ready to Scale Your Business?
            </h3>
            <p className="text-lg mb-6 opacity-90">
              Join thousands of entrepreneurs already using our AI-powered platform
            </p>
            <Button 
              onClick={() => !user ? (window.location.href = '/auth') : handlePlanSelect('professional')}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-3"
            >
              Start Your Free Trial
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription Upgrade Modal */}
      {showUpgrade && (
        <SubscriptionUpgrade
          featureName={selectedPlan === 'professional' ? 'Professional Plan' : 'Enterprise Plan'}
          onUpgrade={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
};

export default PricingPlans;