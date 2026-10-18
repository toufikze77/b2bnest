import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, User, Target, TrendingUp, FileText, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserPreferences {
  id?: string;
  industry?: string;
  business_stage?: string;
  preferred_ai_features: string[];
  interaction_history: any;
}

const SmartPersonalization = () => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    preferred_ai_features: [],
    interaction_history: {}
  });
  const [isSaving, setIsSaving] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const { toast } = useToast();

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
    'Professional Services', 'Real Estate', 'Education', 'Food & Beverage', 'Other'
  ];

  const businessStages = [
    'Startup', 'Growth Stage', 'Established', 'Scale-up', 'Enterprise'
  ];

  const aiFeatures = [
    { id: 'document_assistant', label: 'Smart Document Assistant', icon: '📄' },
    { id: 'business_advisor', label: 'AI Business Advisor', icon: '💼' },
    { id: 'cost_forecasting', label: 'Cost Forecasting', icon: '📊' },
    { id: 'workflow_automation', label: 'Workflow Automation', icon: '⚙️' },
    { id: 'industry_insights', label: 'Industry Insights', icon: '🔍' },
    { id: 'template_customization', label: 'Smart Template Customization', icon: '🎨' }
  ];

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (preferences.industry && preferences.business_stage) {
      generateRecommendations();
    }
  }, [preferences.industry, preferences.business_stage]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_ai_preferences')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_ai_preferences')
        .upsert({
          user_id: user.user.id,
          industry: preferences.industry,
          business_stage: preferences.business_stage,
          preferred_ai_features: preferences.preferred_ai_features,
          interaction_history: preferences.interaction_history
        });

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your AI personalization settings have been updated!",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateRecommendations = () => {
    const industryRecommendations: { [key: string]: string[] } = {
      'technology': [
        'Focus on IP protection and NDAs',
        'Implement agile project management workflows',
        'Use automated code documentation tools'
      ],
      // General advice only: B2BNEST does not monitor or certify compliance with any law or standard.
      'healthcare': [
        'Get specialist advice on the data-protection rules that apply to patient information',
        'Keep patient records in systems built for them, not in general business tools',
        'Start consent forms from a template and have them checked before use'
      ],
      'finance': [
        'Check which regulator\'s rules apply to you and keep your own record of how you meet them',
        'Keep invoices and expenses up to date so reports are easy to produce',
        'Note who changed key financial records and when'
      ],
      'retail': [
        'Focus on customer data management',
        'Implement inventory tracking workflows',
        'Use supplier agreement templates'
      ]
    };

    const stageRecommendations: { [key: string]: string[] } = {
      'startup': [
        'Start with free document templates',
        'Focus on basic legal protections',
        'Use simple workflow automation'
      ],
      'growth_stage': [
        'Scale your document processes',
        'Review your reports regularly as the business grows',
        'Write down the checks your sector requires and who owns them'
      ],
      'established': [
        'Review and simplify existing workflows',
        'Use reports to spot trends early',
        'Give each team member the access they need, and no more'
      ]
    };

    const newRecommendations = [
      ...(industryRecommendations[preferences.industry?.toLowerCase() || ''] || []),
      ...(stageRecommendations[preferences.business_stage?.toLowerCase().replace(/\s+/g, '_') || ''] || [])
    ];

    setRecommendations(newRecommendations);
  };

  const toggleFeature = (featureId: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_ai_features: prev.preferred_ai_features.includes(featureId)
        ? prev.preferred_ai_features.filter(id => id !== featureId)
        : [...prev.preferred_ai_features, featureId]
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <CardTitle>Smart Personalization</CardTitle>
              <CardDescription>
                Customize your AI experience based on your industry and business needs
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Business Profile */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Business Profile
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Industry</label>
                <Select 
                  value={preferences.industry || ''} 
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, industry: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry.toLowerCase()}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Business Stage</label>
                <Select 
                  value={preferences.business_stage || ''} 
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, business_stage: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessStages.map((stage) => (
                      <SelectItem key={stage} value={stage.toLowerCase()}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* AI Features Preferences */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Preferred AI Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiFeatures.map((feature) => (
                <div key={feature.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={feature.id}
                    checked={preferences.preferred_ai_features.includes(feature.id)}
                    onCheckedChange={() => toggleFeature(feature.id)}
                  />
                  <label 
                    htmlFor={feature.id} 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <span className="mr-2">{feature.icon}</span>
                    {feature.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={savePreferences} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Saving Preferences...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Save Personalization Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Personalized Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Personalized Recommendations
            </CardTitle>
            <CardDescription>
              Based on your {preferences.industry} industry and {preferences.business_stage} stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-medium text-blue-800">
                    {index + 1}
                  </div>
                  <p className="text-sm text-blue-900">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Personalization Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">85%</div>
              <div className="text-sm text-green-700">More Relevant Content</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">60%</div>
              <div className="text-sm text-blue-700">Faster Task Completion</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">40%</div>
              <div className="text-sm text-purple-700">Reduced Manual Work</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartPersonalization;