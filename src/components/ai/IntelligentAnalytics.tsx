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

  const parseInsightData = (data: any) => {
    if (typeof data === 'string') {
      try {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(data);
        return parsed;
      } catch {
        return { analysis: data };
      }
    }
    return data;
  };

  const renderInsightContent = (insight: InsightData) => {
    const data = parseInsightData(insight.data);
    
    if (insight.insight_type === 'cost_forecast') {
      return (
        <div className="space-y-6">
          {/* Cost Trends */}
          {data.cost_trends && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Cost Trends Analysis
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Average Monthly Expense:</span>
                  <div className="text-lg font-bold text-blue-900">${data.cost_trends.average_monthly_expense?.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Trend:</span>
                  <div className="text-blue-900">{data.cost_trends.trend}</div>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Pattern:</span>
                  <div className="text-blue-900">{data.cost_trends.pattern}</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Savings Opportunities */}
          {data.cost_savings_opportunities && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Cost Savings Opportunities
              </h4>
              <div className="space-y-3">
                {data.cost_savings_opportunities.recommendations?.map((rec: any, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-green-200">
                    <div className="font-medium text-green-800">{rec.area}</div>
                    <div className="text-sm text-green-700 mt-1">{rec.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Recommendations */}
          {data.budget_recommendations && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Budget Forecast
              </h4>
              <div className="grid grid-cols-3 gap-4 mb-3">
                {Object.entries(data.budget_recommendations.forecast || {}).map(([month, amount]) => (
                  <div key={month} className="text-center bg-white p-2 rounded border border-purple-200">
                    <div className="text-sm text-purple-700 font-medium">{month}</div>
                    <div className="text-lg font-bold text-purple-900">${(amount as number).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {data.budget_recommendations.rationale && (
                <div className="text-sm text-purple-700 bg-white p-3 rounded border border-purple-200">
                  <strong>Rationale:</strong> {data.budget_recommendations.rationale}
                </div>
              )}
            </div>
          )}

          {/* Risk Factors */}
          {data.risk_factors && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Factors
              </h4>
              <div className="space-y-3">
                {data.risk_factors.potential_risks?.map((risk: any, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-red-200">
                    <div className="font-medium text-red-800">{risk.risk}</div>
                    <div className="text-sm text-red-700 mt-1">{risk.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (insight.insight_type === 'document_usage') {
      return (
        <div className="space-y-6">
          {/* Usage Statistics */}
          {data.usage_analysis && (
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Document Usage Statistics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {Object.entries(data.usage_analysis.top_categories || {}).map(([category, count]) => (
                  <div key={category} className="text-center bg-white p-3 rounded border border-indigo-200">
                    <div className="text-sm text-indigo-700 font-medium capitalize">{category.replace('_', ' ')}</div>
                    <div className="text-xl font-bold text-indigo-900">{count as number}</div>
                  </div>
                ))}
              </div>
              {data.usage_analysis.total_downloads && (
                <div className="text-center bg-white p-3 rounded border border-indigo-200">
                  <div className="text-sm text-indigo-700 font-medium">Total Downloads</div>
                  <div className="text-2xl font-bold text-indigo-900">{data.usage_analysis.total_downloads}</div>
                </div>
              )}
            </div>
          )}

          {/* Insights */}
          {data.insights && (
            <div className="bg-cyan-50 p-4 rounded-lg">
              <h4 className="font-semibold text-cyan-900 mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Key Insights
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded border border-cyan-200">
                  <div className="text-sm text-cyan-700 font-medium">Most Popular</div>
                  <div className="text-cyan-900">{data.insights.most_popular}</div>
                </div>
                <div className="bg-white p-3 rounded border border-cyan-200">
                  <div className="text-sm text-cyan-700 font-medium">Least Used</div>
                  <div className="text-cyan-900">{data.insights.least_used}</div>
                </div>
                <div className="bg-white p-3 rounded border border-cyan-200">
                  <div className="text-sm text-cyan-700 font-medium">Trend</div>
                  <div className="text-cyan-900">{data.insights.trend}</div>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Optimization Recommendations
              </h4>
              <div className="space-y-2">
                {data.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-amber-200 text-amber-800">
                    • {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (insight.insight_type === 'industry_trend') {
      return (
        <div className="space-y-6">
          {/* Market Opportunities */}
          {data.market_opportunities && (
            <div className="bg-emerald-50 p-4 rounded-lg">
              <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Market Opportunities
              </h4>
              <div className="space-y-3">
                {data.market_opportunities.map((opp: any, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-emerald-200">
                    <div className="font-medium text-emerald-800">{opp.opportunity}</div>
                    <div className="text-sm text-emerald-700 mt-1">{opp.potential_impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technology Trends */}
          {data.technology_trends && (
            <div className="bg-violet-50 p-4 rounded-lg">
              <h4 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Technology Trends
              </h4>
              <div className="space-y-3">
                {data.technology_trends.map((trend: any, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-violet-200">
                    <div className="font-medium text-violet-800">{trend.trend}</div>
                    <div className="text-sm text-violet-700 mt-1">
                      <span className="font-medium">Adoption:</span> {trend.adoption_rate} | 
                      <span className="font-medium"> Impact:</span> {trend.business_impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic Recommendations */}
          {data.strategic_recommendations && (
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Strategic Recommendations
              </h4>
              <div className="space-y-2">
                {data.strategic_recommendations.map((rec: string, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border border-orange-200 text-orange-800">
                    • {rec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Fallback for any unstructured data
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">Raw Data (parsing failed):</div>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-3 rounded border max-h-64 overflow-auto">
          {typeof data === 'object' ? JSON.stringify(data, null, 2) : data}
        </pre>
      </div>
    );
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
                    {renderInsightContent(insight)}
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