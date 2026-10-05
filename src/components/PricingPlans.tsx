import React, { useRef, useState } from 'react';
import { Check, Zap, Crown, Building2, Sparkles, Users, TrendingUp, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const PricingPlans = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const { user } = useAuth();
  const { subscribed, subscription_tier } = useSubscription();
  const currentPlanId = subscribed ? String(subscription_tier || '').toLowerCase() : null;
  const isCurrent = (planId: string) => currentPlanId === planId;

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for solopreneurs and small teams',
      icon: Zap,
      color: 'from-blue-500 to-cyan-500',
      monthly: 19,
      annual: 190,
      userLimit: '1 user',
      features: [
        '250 AI credits/month (~250 conversations)',
        'AI Business Advisor',
        'Basic document templates',
        'AI Studio (Basic features)',
        'Invoice & Quote generator',
        'Priority support',
        'Advanced AI analytics & workflows',
        'QR Code Generator',
        'Time Tracker',
        'Cash Flow Tracker',
        'ROI Calculator',
        'Email support',
        'Mobile app access',
      ],
      cta: 'Subscribe',
      popular: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For growing teams and serious entrepreneurs',
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
      monthly: 35,
      annual: 350,
      userLimit: '5 users',
      features: [
        '1,000 AI credits/month (~1,000 conversations)',
        'Everything in Starter',
        'AI Studio (Full access)',
        'Advanced AI analytics & workflows',
        'Intelligent automation builder',
        'Smart personalization engine',
        'Premium document templates',
        'CRM & Project Management',
        'Invoice & Quote generator',
        'Priority support',
        'Team collaboration tools',
        'Custom integrations',
      ],
      cta: 'Subscribe',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For scaling businesses and larger teams',
      icon: Building2,
      color: 'from-emerald-500 to-teal-500',
      monthly: 85,
      annual: 850,
      userLimit: '25 users',
      features: [
        '5,000 AI credits/month (~5,000 conversations)',
        'Everything in Professional',
        'AI Studio (Enterprise features)',
        'Custom AI model training',
        'Advanced workflow automation',
        'Advanced analytics',
        'Custom AI integrations',
        'White-label AI solutions',
        'Dedicated account manager',
        'Custom integrations & API',
        'Training & onboarding',
        'SLA guarantee',
      ],
      cta: 'Subscribe',
      popular: false,
    },
  ];

  const changeLock = useRef(false);
  const readError = async (error: unknown) => {
    const ctx = (error as { context?: { json: () => Promise<{ error?: string; message?: string }> } }).context;
    return ctx ? await ctx.json().catch(() => null) : null;
  };
  const handlePlanChange = async (planId: string, planName: string) => {
    if (changeLock.current) return;
    changeLock.current = true;
    setCheckoutPlan(planId);
    try {
      const { data: preview, error: previewError } = await supabase.functions.invoke('change-subscription-plan', { body: { mode: 'preview', planId, isAnnual } });
      if (previewError) {
        const body = await readError(previewError);
        throw new Error(body?.error === 'no_subscription' ? 'No active subscription was found. Open Settings → Billing, or contact support.' : body?.message || previewError.message);
      }
      const money = (pence: number) => `£${(Math.abs(pence) / 100).toFixed(2)}`;
      const per = preview.newInterval === 'year' ? 'year' : 'month';
      const due = Number(preview.amountDueNow) || 0;
      const dateText = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the end of your billing period';
      const message = (preview.scheduled ? [
        `Switch from ${preview.currentPlan ?? 'your current plan'} to ${preview.newPlan} (${money(preview.newPrice)} per ${per})?`,
        '',
        `This change starts on ${dateText(preview.effectiveDate)}, at the end of the period you've already paid for.`,
        `You keep ${preview.currentPlan ?? 'your current plan'} until then. Nothing is charged now, and there's no automatic refund or credit for unused time.`,
        'You can keep your current plan instead from Settings → Billing before that date.',
      ] : [
        `Switch from ${preview.currentPlan ?? 'your current plan'} to ${preview.newPlan} (${money(preview.newPrice)} per ${per})?`,
        '',
        'Your existing subscription is updated — no second subscription is created.',
        due > 0
          ? `You'll be charged ${money(due)} now for the rest of this billing period (the new price minus unused time on your current plan).`
          : 'Nothing extra is charged now.',
        preview.intervalChanges ? `Your billing period changes to ${per}ly, starting today.` : '',
        preview.cancelsPendingDowngrade ? 'Your pending downgrade will be cancelled.' : '',
        'If the payment fails, your current plan stays as it is.',
      ]).filter((l) => l !== undefined).join('\n');
      if (!window.confirm(message)) return;
      const requestId = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('change-subscription-plan', { body: { planId, isAnnual, requestId } });
      if (error) {
        const body = await readError(error);
        throw new Error(body?.message || error.message);
      }
      if (data?.scheduled) {
        toast({ title: 'Plan change scheduled', description: `You'll move to ${data?.newPlan ?? planName} on ${dateText(data?.effectiveDate)}. You keep your current plan until then.` });
        return;
      }
      await supabase.functions.invoke('check-subscription').catch(() => undefined);
      toast({ title: 'Plan changed', description: `You're now on ${data?.plan ?? planName}.` });
      window.location.reload();
    } catch (err: unknown) {
      toast({ title: 'Plan not changed', description: err instanceof Error ? err.message : 'Your plan hasn\'t changed. Please try again later.', variant: 'destructive' });
    } finally {
      changeLock.current = false;
      setCheckoutPlan(null);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to subscribe to a plan.",
        variant: "destructive"
      });
      window.location.href = '/auth';
      return;
    }

    setCheckoutPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { planId, isAnnual },
      });

      if (error) {
        const context = (error as { context?: { text: () => Promise<string> } }).context;
        const details = context ? await context.text().catch(() => '') : '';
        if (details.includes('already_subscribed')) {
          toast({
            title: 'You already have a subscription',
            description: 'Open Settings → Billing to change or cancel your current plan.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('Could not start checkout');
    } catch (err: unknown) {
      toast({
        title: 'Checkout unavailable',
        description: err instanceof Error ? err.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setCheckoutPlan(null);
    }
  };


  const handleStartTrial = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('activate-trial', { body: { source: 'pricing' } });
      if (error) throw error;
      toast({
        title: data?.status === 'already_active' ? 'Trial Already Active' : 'Free Trial Activated!',
        description: data?.trial_ends_at
          ? `Enterprise access until ${new Date(data.trial_ends_at).toLocaleString()}`
          : 'You now have Enterprise access for 14 days.',
      });
      // Refresh subscription and trial state
      try { (window as any).gtag?.('event', 'trial_activated'); } catch {}
      window.location.reload();
    } catch (err: any) {
      console.error('activate-trial error', err);
      toast({
        title: 'Could not start trial',
        description: err?.message || 'Please try again later.',
        variant: 'destructive',
      });
    }
  };
  const getCurrentPlanBadge = (planId: string) =>
    isCurrent(planId) ? <Badge className="absolute -top-1 -right-2">Your current plan</Badge> : null;

  return (
    <>
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
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {plans.map((plan) => {
            const PlanIcon = plan.icon;
            const price = isAnnual ? plan.annual : plan.monthly;
            
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
                         <span className="text-sm text-gray-500">{isAnnual ? '/year' : '/month'}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {plan.userLimit}
                        {isAnnual && <span className="block text-xs">Billed annually (2 months free)</span>}
                      </p>
                   </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button 
                    onClick={() => (subscribed ? handlePlanChange(plan.id, plan.name) : handlePlanSelect(plan.id))}
                    disabled={checkoutPlan !== null || isCurrent(plan.id)}
                    aria-disabled={isCurrent(plan.id)}
                    className={`w-full mb-6 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                        : plan.id === 'enterprise'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                        : 'bg-gray-900 hover:bg-gray-800'
                    } text-white font-semibold py-3`}
                  >
                    {isCurrent(plan.id) ? 'Your current plan' : checkoutPlan === plan.id ? (subscribed ? 'Checking…' : 'Redirecting to checkout…') : subscribed ? `Switch to ${plan.name}` : plan.cta}
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
                Yes. Choose "Switch to" on another plan — your existing subscription is changed, never duplicated. Upgrades start now and you pay the difference for the rest of the period. Downgrades start at the end of your paid period, with no charge now and no automatic refund or credit for unused time (your statutory rights are unaffected). To cancel, keep your current plan or update your card, use Settings → Billing.
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
              Subscriptions are billed securely by Stripe and accept all major credit and debit cards.
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
              Try every feature free for 14 days.
            </p>
            <Button 
              onClick={handleStartTrial}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-3"
            >
              Start Your Free Trial
            </Button>
          </div>
        </div>
      </div>

      </div>
    </>
  );
};

export default PricingPlans;