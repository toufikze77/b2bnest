import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Workflow, Sparkles, Lock, BookOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { aiFeatureLock, type AiFeatureId } from "@/lib/aiStudio";
import { GUIDE_PATH } from "@/lib/workflowGuide";
import Footer from "@/components/Footer";
import AIBusinessAdvisor from "@/components/ai/AIBusinessAdvisor";
import IntelligentAnalytics from "@/components/ai/IntelligentAnalytics";
import SmartPersonalization from "@/components/ai/SmartPersonalization";
import SubscriptionUpgrade from "@/components/SubscriptionUpgrade";
import { WORKFLOWS_NOT_INCLUDED_MESSAGE } from "../../supabase/functions/_shared/workflow-access.ts";

/** Shown instead of a tab when the server would refuse it (trial ended, suspended). Never a payment screen when suspended. */
const LockedPanel = ({ lock }: { lock: NonNullable<ReturnType<typeof aiFeatureLock>> }) => (
  lock.action === 'contact' ? (
    <Card data-testid="locked-panel">
      <CardHeader><CardTitle>{lock.title}</CardTitle><CardDescription>{lock.message}</CardDescription></CardHeader>
      <CardContent><Button variant="outline" asChild><Link to="/contact">Contact us</Link></Button></CardContent>
    </Card>
  ) : (
    <div data-testid="locked-panel" className="space-y-4">
      <Card><CardHeader><CardTitle>{lock.title}</CardTitle><CardDescription>{lock.message}</CardDescription></CardHeader></Card>
      <SubscriptionUpgrade featureName={lock.title} />
    </div>
  )
);

const AIStudio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Phase 20: locks follow the server's rules (my_access_state() + the workflow plan rule), see src/lib/aiStudio.ts.
  const access = useAccess();
  const lockOf = (id: AiFeatureId) => (user && !access.loading ? aiFeatureLock(access, id) : null);
  const [activeTab, setActiveTab] = useState("advisor");

  const aiFeatures: { id: AiFeatureId; title: string; description: string; icon: typeof Brain; color: string }[] = [
    {
      id: "advisor",
      title: "AI Business Advisor",
      description: "General strategic advice for your industry and stage. One AI credit per answer",
      icon: Brain,
      color: "from-blue-500 to-purple-600"
    },
    {
      id: "analytics",
      title: "Intelligent Analytics",
      description: "Try AI cost forecasting on example figures (your own data is not connected yet)",
      icon: TrendingUp,
      color: "from-green-500 to-teal-600"
    },
    {
      id: "workflows",
      title: "Workflows",
      description: "Send a list of emails with one click. Included in Business and Scale",
      icon: Workflow,
      color: "from-orange-500 to-red-600"
    },
    {
      id: "personalization",
      title: "Smart Personalization",
      description: "General guidance for your industry and stage (not AI, not based on your data)",
      icon: Sparkles,
      color: "from-pink-500 to-rose-600"
    }
  ];

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">AI Studio</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ask the AI Business Advisor for general strategic advice, and try AI analysis on example figures.
            Connecting your own business data comes later.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {aiFeatures.map((feature) => {
            const IconComponent = feature.icon;
            const lock = lockOf(feature.id);
            const isLocked = !!lock;
            
            return (
              <Card 
                key={feature.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-xl relative ${
                  activeTab === feature.id ? 'ring-2 ring-blue-500 shadow-lg' : ''
                } ${isLocked ? 'opacity-75' : ''}`}
                onClick={() => setActiveTab(feature.id)}
              >
                {isLocked && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge className="bg-orange-500 text-white text-xs" data-testid={`lock-${feature.id}`}>
                      <Lock className="h-3 w-3 mr-1" aria-hidden="true" />
                      {lock.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 relative`}>
                    <IconComponent className="h-8 w-8 text-white" />
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                        <Lock className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* AI Feature Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            {aiFeatures.map((feature) => (
              <TabsTrigger key={feature.id} value={feature.id} className="text-sm">
                {feature.title.split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="advisor" className="space-y-6">
            {lockOf('advisor') ? <LockedPanel lock={lockOf('advisor')!} /> : <AIBusinessAdvisor />}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {lockOf('analytics') ? <LockedPanel lock={lockOf('analytics')!} /> : <IntelligentAnalytics />}
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            {/* Phase 20: the same rule as Workflow Studio and the server (_shared/workflow-access.ts). */}
            {lockOf('workflows') ? (
              <Card data-testid="workflows-card-upgrade">
                <CardHeader>
                  <CardTitle>{WORKFLOWS_NOT_INCLUDED_MESSAGE}</CardTitle>
                  <CardDescription>{lockOf('workflows')!.message} Workflows send a list of emails with one click, with an exact preview first. Saved workflows are kept.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild><Link to="/pricing">See plans</Link></Button>
                  <Button variant="ghost" asChild><Link to={GUIDE_PATH}><BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />How workflows work</Link></Button>
                </CardContent>
              </Card>
            ) : (
              <Card data-testid="workflows-card">
                <CardHeader>
                  <CardTitle>Workflows have their own section</CardTitle>
                  <CardDescription>Send a list of emails with one click, with an exact preview first. Workflows are included in the Business and Scale plans, and during the 14-day trial.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate('/workflow-studio')}>Open Workflows</Button>
                  <Button variant="ghost" asChild><Link to={GUIDE_PATH}><BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />How workflows work</Link></Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="personalization" className="space-y-6">
            {lockOf('personalization') ? <LockedPanel lock={lockOf('personalization')!} /> : <SmartPersonalization />}
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Back to your business</h3>
              <p className="text-lg mb-6 opacity-90">
                Your projects, customers and finances are on the dashboard.
              </p>
              <Button 
                variant="secondary" 
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Get Started Today
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default AIStudio;