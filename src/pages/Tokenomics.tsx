import React from 'react';
import { Coins, PieChart, TrendingUp, Lock, Users, Zap, Target, Repeat, ArrowRight, Sparkles, ShieldCheck, Rocket, BarChart3, Wallet, Crown, Vote, Building2, Network, CircleDollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';

import ShareButton from '@/components/ShareButton';
import tokenomicsInfographic from '@/assets/b2bn-tokenomics-infographic.png';

import { Pie, PieChart as RechartsePie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const Tokenomics = () => {
  const navigate = useNavigate();

  const distributionData = [
    { name: 'Ecosystem & Community', value: 30, color: 'hsl(142, 71%, 45%)' },
    { name: 'Private Sale', value: 20, color: 'hsl(217, 91%, 60%)' },
    { name: 'Team & Advisors (Vested)', value: 15, color: 'hsl(271, 91%, 65%)' },
    { name: 'Treasury', value: 15, color: 'hsl(258, 90%, 66%)' },
    { name: 'Strategic Partners', value: 10, color: 'hsl(38, 92%, 50%)' },
    { name: 'Liquidity & Listings', value: 10, color: 'hsl(48, 96%, 53%)' },
  ];

  const chartConfig = { value: { label: "Percentage" } };

  const ecosystemFlow = [
    { num: '1', title: 'Participants Join', desc: 'Users lock B2BN to access tools and engage with the platform', icon: Users },
    { num: '2', title: 'Platform Usage', desc: 'AI tools, SaaS features, and services are actively used', icon: Zap },
    { num: '3', title: 'Revenue Generation', desc: 'The platform generates income through real economic activity', icon: TrendingUp },
    { num: '4', title: 'Value Distribution', desc: 'A portion of value is shared with participants', icon: CircleDollarSign },
    { num: '5', title: 'Ecosystem Growth', desc: 'More users → more usage → more value', icon: Network },
  ];

  const utilityItems = [
    { icon: Sparkles, title: 'Access AI Tools', desc: 'Use AI-powered features across the platform' },
    { icon: Crown, title: 'Premium SaaS Features', desc: 'Unlock advanced tools and content' },
    { icon: Wallet, title: 'Pay for Services', desc: 'Settle platform services using B2BN' },
    { icon: Rocket, title: 'Ecosystem Growth', desc: 'Participate directly in network expansion' },
    { icon: Vote, title: 'Governance (Future)', desc: 'Vote on key decisions and proposals' },
  ];

  const distribution = [
    { label: 'Ecosystem & Community', value: 30, color: 'bg-emerald-500', note: 'Staking Rewards, Airdrops' },
    { label: 'Private Sale', value: 20, color: 'bg-blue-500', note: '' },
    { label: 'Team & Advisors', value: 15, color: 'bg-purple-500', note: 'Vested' },
    { label: 'Treasury', value: 15, color: 'bg-violet-500', note: 'Ecosystem Growth' },
    { label: 'Strategic Partners', value: 10, color: 'bg-orange-500', note: '' },
    { label: 'Liquidity & Listings', value: 10, color: 'bg-yellow-500', note: '' },
  ];

  const economicPrinciples = [
    'No guaranteed returns',
    'Rewards linked to real usage',
    'Controlled token distribution',
    'Focus on long-term sustainability',
  ];

  const keyOutcomes = [
    { icon: TrendingUp, title: 'Growing Ecosystem', desc: 'Continuous user and product expansion' },
    { icon: Target, title: 'Increasing Demand', desc: 'Real utility drives organic token demand' },
    { icon: Lock, title: 'Reduced Circulating Supply', desc: 'Active participation locks supply' },
    { icon: Sparkles, title: 'Long-Term Value Potential', desc: 'Designed for sustainable appreciation' },
  ];

  const investorBenefits = [
    'Exposure to SaaS + AI ecosystem',
    'Participation-based rewards',
    'Increasing demand as adoption grows',
    'Early-stage positioning advantage',
  ];

  const riskControls = [
    'No fixed reward promises',
    'No reliance on continuous new buyers',
    'No uncontrolled inflation',
  ];

  const roadmap = [
    { phase: 'Phase 1', title: 'Launch & Adoption', desc: 'User onboarding, early incentives' },
    { phase: 'Phase 2', title: 'Expansion', desc: 'Platform growth, increased usage' },
    { phase: 'Phase 3', title: 'Scale', desc: 'Revenue-driven ecosystem maturity' },
  ];

  const investmentThesis = [
    'Real demand from product usage',
    'Revenue-backed value flow',
    'Strong alignment between users and investors',
    'Scalable SaaS + AI model',
  ];

  return (
    <>
      <TokenSEO page="tokenomics" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="pt-20 pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* ========= PART 1: ECOSYSTEM PAGE ========= */}

            {/* SECTION 1 — HERO */}
            <section className="text-center mb-20">
              <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-100">Ecosystem Overview</Badge>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                A Token Designed for <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Real Utility and Growth</span>
              </h1>
              <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
                B2BN powers the B2BNEST ecosystem — connecting users, tools, and value through real platform activity.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-8 text-sm text-gray-700">
                <span className="px-3 py-1 bg-white rounded-full border">No fixed returns</span>
                <span className="px-3 py-1 bg-white rounded-full border">No artificial rewards</span>
                <span className="px-3 py-1 bg-white rounded-full border">Only value generated through usage</span>
              </div>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600" onClick={() => navigate('/business-tools')}>
                  Start Participating <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <ShareButton variant="outline" size="default" />
              </div>
            </section>

            {/* INFOGRAPHIC */}
            <section className="mb-20">
              <Card className="overflow-hidden border-2 border-purple-200">
                <img
                  src={tokenomicsInfographic}
                  alt="B2BN Tokenomics infographic showing utility, distribution, value flow, and ecosystem cycle"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </Card>
            </section>

            {/* SECTION 2 — HOW THE ECOSYSTEM WORKS */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">How It Works</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">A Self-Sustaining Value Cycle</h2>
              </div>
              <div className="grid md:grid-cols-5 gap-4">
                {ecosystemFlow.map((step) => {
                  const Icon = step.icon;
                  return (
                    <Card key={step.num} className="relative hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold flex items-center justify-center mb-3">
                          {step.num}
                        </div>
                        <Icon className="h-6 w-6 text-purple-600 mb-2" />
                        <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                        <p className="text-sm text-gray-600">{step.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-center text-gray-700 mt-6 font-medium">
                This cycle strengthens the entire network over time.
              </p>
            </section>

            {/* SECTION 3 — VALUE & REWARDS */}
            <section className="mb-20">
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
                <CardContent className="p-8 md:p-12">
                  <Badge className="mb-4 bg-white text-purple-700">Performance-Based</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Performance-Based Value Distribution</h2>
                  <p className="text-lg text-gray-700 mb-6">Rewards are not fixed. They are:</p>
                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    {['Linked to platform activity', 'Influenced by user growth', 'Designed for long-term sustainability'].map((item) => (
                      <div key={item} className="flex items-start gap-3 bg-white rounded-lg p-4">
                        <ShieldCheck className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-800">{item}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Participants benefit from:</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {['Ecosystem performance', 'Increased demand for services', 'Expanding platform usage'].map((item) => (
                      <div key={item} className="flex items-center gap-3 bg-white rounded-lg p-4">
                        <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <span className="text-gray-800 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* SECTION 4 — TOKEN UTILITY */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Token Utility</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Built for Real Use</h2>
                <p className="text-lg text-gray-600">B2BN is used across the ecosystem.</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                {utilityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} className="hover:shadow-lg hover:-translate-y-1 transition-all">
                      <CardContent className="pt-6 text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                          <Icon className="h-7 w-7 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-center text-purple-700 font-semibold mt-6">→ Utility drives demand</p>
            </section>

            {/* SECTION 5 — TOKEN DISTRIBUTION */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">Distribution</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Balanced for Growth and Sustainability</h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-purple-600" />
                      Token Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {distribution.map((item, idx) => (
                        <div key={item.label} className="animate-fade-in" style={{ animationDelay: `${idx * 0.1}s`, animationFillMode: 'backwards' }}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                              <span className="text-sm font-medium">
                                {item.label} {item.note && <span className="text-xs text-gray-500">({item.note})</span>}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">{item.value}%</span>
                          </div>
                          <Progress value={item.value} className="h-2" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-100 flex items-start gap-2">
                      <Lock className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">
                        Vesting and lock mechanisms ensure long-term alignment.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Visual Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsePie>
                          <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ value }) => `${value}%`}
                            outerRadius={120}
                            innerRadius={60}
                            dataKey="value"
                          >
                            {distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        </RechartsePie>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* SECTION 6 — VALUE FLOW */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-cyan-100 text-cyan-700 hover:bg-cyan-100">Value Flow</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Driven by Real Activity</h2>
              </div>
              <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <CardContent className="p-8">
                  <div className="flex flex-wrap items-center justify-center gap-3 text-lg font-semibold">
                    {['Participants', 'Platform Usage', 'Revenue', 'Shared Value', 'Stronger Ecosystem'].map((step, idx, arr) => (
                      <React.Fragment key={step}>
                        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-3">{step}</div>
                        {idx < arr.length - 1 && <ArrowRight className="h-5 w-5 opacity-70" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-center mt-6 text-purple-100">A system powered by demand, not inflation.</p>
                </CardContent>
              </Card>
            </section>

            {/* SECTION 7 — ECONOMIC DESIGN */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Economic Design</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Built on Real Economics</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {economicPrinciples.map((principle) => (
                  <Card key={principle} className="border-2 border-gray-200 hover:border-purple-300 transition-colors">
                    <CardContent className="pt-6 text-center">
                      <ShieldCheck className="h-8 w-8 text-green-600 mx-auto mb-3" />
                      <p className="font-medium text-gray-800">{principle}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* SECTION 8 — KEY OUTCOMES */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-pink-100 text-pink-700 hover:bg-pink-100">Outcomes</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">What This Creates</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {keyOutcomes.map((outcome) => {
                  const Icon = outcome.icon;
                  return (
                    <Card key={outcome.title} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <Icon className="h-8 w-8 text-purple-600 mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-2">{outcome.title}</h3>
                        <p className="text-sm text-gray-600">{outcome.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* SECTION 9 — CTA */}
            <section className="mb-24">
              <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
                <CardContent className="text-center py-12 px-6">
                  <Rocket className="h-14 w-14 mx-auto mb-4 opacity-90" />
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">Start Participating in the Ecosystem</h2>
                  <p className="text-purple-100 mb-8 max-w-2xl mx-auto text-lg">
                    Access tools. Contribute to growth. Earn from real activity.
                  </p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Button size="lg" variant="secondary" onClick={() => navigate('/business-tools')}>
                      Join the Ecosystem <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ========= PART 2: INVESTOR PITCH ========= */}

            <div className="border-t-2 border-dashed border-gray-300 mb-20"></div>

            {/* INVESTOR HERO */}
            <section className="text-center mb-20">
              <Badge className="mb-6 bg-amber-100 text-amber-700 hover:bg-amber-100">For Investors</Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Own the Token Powering a <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">Real Digital Economy</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                B2BN connects investors to a growing SaaS and AI ecosystem — where value is created through usage, not speculation.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => navigate('/b2b-form')}>
                  Request Access <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => document.getElementById('token-allocation')?.scrollIntoView({ behavior: 'smooth' })}>
                  View Tokenomics
                </Button>
              </div>
            </section>

            {/* THE OPPORTUNITY */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-red-100 text-red-700 hover:bg-red-100">The Opportunity</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">A Shift From Speculation to Utility</h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">Most tokens rely on hype. B2BN is built on:</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {[
                  { title: 'Real Products', icon: Building2 },
                  { title: 'Real Users', icon: Users },
                  { title: 'Real Revenue Streams', icon: CircleDollarSign },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} className="text-center">
                      <CardContent className="pt-8 pb-6">
                        <Icon className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                        <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-center text-amber-700 font-semibold text-lg">→ Value is created, not promised</p>
            </section>

            {/* HOW VALUE IS CREATED */}
            <section className="mb-20">
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
                <CardContent className="p-8 md:p-12">
                  <Badge className="mb-4 bg-white text-amber-700">Revenue Model</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">A Revenue-Driven Model</h2>
                  <div className="space-y-4 mb-6">
                    {[
                      'Users pay for AI tools and SaaS features',
                      'Platform generates recurring income',
                      'Value is distributed to participants',
                    ].map((item, idx) => (
                      <div key={item} className="flex items-start gap-4 bg-white rounded-lg p-4">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-gray-800 font-medium pt-1">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-amber-700 font-semibold text-lg">→ Growth drives rewards</p>
                </CardContent>
              </Card>
            </section>

            {/* INVESTOR BENEFITS */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Benefits</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Aligned With Platform Growth</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {investorBenefits.map((benefit) => (
                  <Card key={benefit} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                      <span className="text-gray-800 font-medium">{benefit}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* ECONOMIC MODEL */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Economic Model</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">A Self-Reinforcing System</h2>
              </div>
              <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <CardContent className="p-8">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {['Users', 'Revenue', 'Rewards', 'Participation', 'Reduced Supply', 'Stronger Value'].map((step, idx, arr) => (
                      <React.Fragment key={step}>
                        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-3 font-semibold">
                          {step}
                        </div>
                        {idx < arr.length - 1 && <ArrowRight className="h-5 w-5 opacity-70" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-center mt-6 text-indigo-100">A cycle designed for scalability.</p>
                </CardContent>
              </Card>
            </section>

            {/* RISK CONTROL */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-rose-100 text-rose-700 hover:bg-rose-100">Risk Control</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Built to Avoid Common Failures</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {riskControls.map((control) => (
                  <Card key={control} className="border-2 border-rose-200">
                    <CardContent className="pt-6 text-center">
                      <ShieldCheck className="h-10 w-10 text-rose-600 mx-auto mb-3" />
                      <p className="font-medium text-gray-800">{control}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-center text-rose-700 font-semibold">→ Focus on sustainability over hype</p>
            </section>

            {/* TOKEN ALLOCATION (consistent reference) */}
            <section id="token-allocation" className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-violet-100 text-violet-700 hover:bg-violet-100">Allocation</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Token Allocation</h2>
                <p className="text-gray-600">Same as ecosystem page — kept consistent across the platform.</p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {distribution.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {item.value}%
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.label}</p>
                          {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* GROWTH ROADMAP */}
            <section className="mb-20">
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-sky-100 text-sky-700 hover:bg-sky-100">Roadmap</Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Growth Roadmap</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {roadmap.map((item, idx) => (
                  <Card key={item.phase} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${idx === 0 ? 'from-sky-400 to-blue-500' : idx === 1 ? 'from-purple-400 to-violet-500' : 'from-amber-400 to-orange-500'}`}></div>
                    <CardContent className="pt-8">
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{item.phase}</p>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* INVESTMENT THESIS */}
            <section className="mb-20">
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <CardContent className="p-8 md:p-12">
                  <Badge className="mb-4 bg-amber-500 text-slate-900 hover:bg-amber-500">Investment Thesis</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold mb-8">Why It Works</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {investmentThesis.map((item) => (
                      <div key={item} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <Sparkles className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* FINAL CLOSE */}
            <section className="mb-12">
              <Card className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white border-0">
                <CardContent className="text-center py-14 px-6">
                  <Coins className="h-16 w-16 mx-auto mb-6 opacity-90" />
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Get In Early. Participate in Growth. Capture Value.
                  </h2>
                  <p className="text-white/90 mb-2 max-w-2xl mx-auto text-lg">
                    B2BN is not just held.
                  </p>
                  <p className="text-white/90 mb-8 max-w-2xl mx-auto text-lg">
                    It is used, integrated, and scaled within a growing ecosystem.
                  </p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Button size="lg" variant="secondary" onClick={() => navigate('/b2b-form')}>
                      Request Access <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white hover:text-orange-600" onClick={() => navigate('/business-tools')}>
                      Explore Tools
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Tokenomics;
