import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Workflow, Calculator, MessageSquare, Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Footer from "@/components/Footer";
import AIBusinessAdvisor from "@/components/ai/AIBusinessAdvisor";
import IntelligentAnalytics from "@/components/ai/IntelligentAnalytics";
import WorkflowBuilder from "@/components/ai/WorkflowBuilder";
import SmartPersonalization from "@/components/ai/SmartPersonalization";
import SubscriptionUpgrade from "@/components/SubscriptionUpgrade";

const AIStudio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessFeature, isPremium, loading } = useSubscription();
  const [activeTab, setActiveTab] = useState("advisor");

  const aiFeatures = [
    {
      id: "advisor",
      title: "AI Business Advisor",
      description: "Get strategic insights and recommendations tailored to your industry",
      icon: Brain,
      color: "from-blue-500 to-purple-600"
    },
    {
      id: "analytics",
      title: "Intelligent Analytics",
      description: "AI-powered cost forecasting and business intelligence",
      icon: TrendingUp,
      color: "from-green-500 to-teal-600"
    },
    {
      id: "workflows",
      title: "Workflow Builder",
      description: "Design automated business processes with AI assistance",
      icon: Workflow,
      color: "from-orange-500 to-red-600"
    },
    {
      id: "personalization",
      title: "Smart Personalization",
      description: "Industry-specific recommendations and customized experience",
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
            Harness the power of artificial intelligence to transform your business operations, 
            get strategic insights, and automate complex workflows.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {aiFeatures.map((feature) => {
            const IconComponent = feature.icon;
            const isLocked = user && !canAccessFeature(feature.id);
            
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
                    <Badge className="bg-orange-500 text-white text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      PREMIUM
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
            {canAccessFeature('advisor') ? (
              <AIBusinessAdvisor />
            ) : (
              <SubscriptionUpgrade 
                featureName="AI Business Advisor" 
                onUpgrade={() => window.location.reload()}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {canAccessFeature('analytics') ? (
              <IntelligentAnalytics />
            ) : (
              <SubscriptionUpgrade 
                featureName="Intelligent Analytics" 
                onUpgrade={() => window.location.reload()}
              />
            )}
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            {canAccessFeature('workflows') ? (
              <WorkflowBuilder />
            ) : (
              <SubscriptionUpgrade 
                featureName="Workflow Builder" 
                onUpgrade={() => window.location.reload()}
              />
            )}
          </TabsContent>

          <TabsContent value="personalization" className="space-y-6">
            {canAccessFeature('personalization') ? (
              <SmartPersonalization />
            ) : (
              <SubscriptionUpgrade 
                featureName="Smart Personalization" 
                onUpgrade={() => window.location.reload()}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Transform Your Business?</h3>
              <p className="text-lg mb-6 opacity-90">
                Experience the full power of AI-driven business automation and insights
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