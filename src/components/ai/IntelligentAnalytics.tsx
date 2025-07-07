import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, BarChart3, PieChart, Target, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InsightData {
  id: string;
  insight_type: string;
  data: any;
  confidence_score: number;
  generated_at: string;
}

const IntelligentAnalytics = () => {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState('');
  const { toast } = useToast();

  const analysisTypes = [
    { value: 'cost_forecast', label: 'Cost Forecasting', icon: TrendingUp },
    { value: 'document_usage', label: 'Document Analytics', icon: BarChart3 },
    { value: 'industry_trends', label: 'Industry Trends', icon: PieChart }
  ];

  // Sample data for demonstration
  const sampleBusinessData = {
    costs: {
      monthly_expenses: [
        { month: 'Jan', amount: 12500, category: 'operations' },
        { month: 'Feb', amount: 13200, category: 'operations' },
        { month: 'Mar', amount: 11800, category: 'operations' }
      ],
      fixed_costs: 8500,
      variable_costs: 4200
    },
    documents: {
      usage_stats: {
        contracts: 45,
        invoices: 123,
        hr_forms: 28,
        marketing: 67
      },
      monthly_downloads: [850, 920, 1100, 980]
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const { data, error } = await supabase
        .from('business_insights')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInsights(data || []);
    } catch (error) {
      console.error('Error loading insights:', error);
    }
  };

  const generateInsight = async () => {
    if (!selectedAnalysis) {
      toast({
        title: "Select Analysis Type",
        description: "Please choose what type of analysis you'd like to generate.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('business-insights', {
        body: {
          analysisType: selectedAnalysis,
          data: selectedAnalysis === 'cost_forecast' ? sampleBusinessData.costs : 
                selectedAnalysis === 'document_usage' ? sampleBusinessData.documents : {},
          industry: 'technology',
          businessStage: 'growth'
        }
      });

      if (error) throw error;

      await loadInsights(); // Reload insights
      toast({
        title: "Analysis Complete",
        description: "New business insights have been generated!",
      });
    } catch (error) {
      console.error('Error generating insight:', error);
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'cost_forecast': return TrendingUp;
      case 'document_usage': return BarChart3;
      case 'industry_trend': return PieChart;
      default: return Target;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle>Intelligent Analytics</CardTitle>
              <CardDescription>
                AI-powered business insights and predictive analytics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Analysis Type</label>
              <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose analysis type" />
                </SelectTrigger>
                <SelectContent>
                  {analysisTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={generateInsight}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Analysis Type Descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysisTypes.map((type) => {
              const IconComponent = type.icon;
              return (
                <Card 
                  key={type.value}
                  className={`cursor-pointer transition-all ${
                    selectedAnalysis === type.value ? 'ring-2 ring-green-500' : ''
                  }`}
                  onClick={() => setSelectedAnalysis(type.value)}
                >
                  <CardContent className="p-4 text-center">
                    <IconComponent className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <h4 className="font-semibold text-sm">{type.label}</h4>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Insights Display */}
      <div className="space-y-4">
        {insights.length > 0 ? (
          insights.map((insight) => {
            const IconComponent = getInsightIcon(insight.insight_type);
            return (
              <Card key={insight.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {insight.insight_type.replace('_', ' ').toUpperCase()}
                        </CardTitle>
                        <CardDescription>
                          Generated on {new Date(insight.generated_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Confidence</div>
                      <div className={`font-bold ${getConfidenceColor(insight.confidence_score)}`}>
                        {Math.round(insight.confidence_score * 100)}%
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress 
                      value={insight.confidence_score * 100} 
                      className="h-2"
                    />
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(insight.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Insights Yet</h3>
              <p className="text-gray-500 mb-4">
                Generate your first AI-powered business insight to get started
              </p>
              <Button 
                onClick={() => setSelectedAnalysis('cost_forecast')}
                variant="outline"
              >
                Get Started with Cost Forecasting
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default IntelligentAnalytics;