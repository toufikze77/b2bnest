import React, { useState } from 'react';
import { TrendingUp, Calculator, DollarSign, BarChart3, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ROICalculation {
  id: string;
  projectName: string;
  initialInvestment: number;
  totalReturns: number;
  timeframe: number; // in months
  roi: number;
  annualizedROI: number;
  createdAt: Date;
}

const ROICalculator = () => {
  const [calculations, setCalculations] = useState<ROICalculation[]>([]);
  const [formData, setFormData] = useState({
    projectName: '',
    initialInvestment: 0,
    totalReturns: 0,
    timeframe: 12
  });
  const { toast } = useToast();

  const calculateROI = () => {
    if (formData.initialInvestment <= 0) {
      toast({
        title: "Invalid Investment",
        description: "Please enter a valid initial investment amount.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.projectName.trim()) {
      toast({
        title: "Missing Project Name",
        description: "Please enter a project name.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 10 calculations max
    if (calculations.length >= 10) {
      toast({
        title: "Calculation Limit Reached",
        description: "Free plan allows up to 10 ROI calculations. Upgrade for unlimited calculations.",
        variant: "destructive"
      });
      return;
    }

    const roi = ((formData.totalReturns - formData.initialInvestment) / formData.initialInvestment) * 100;
    const annualizedROI = Math.pow((formData.totalReturns / formData.initialInvestment), (12 / formData.timeframe)) - 1;

    const calculation: ROICalculation = {
      id: Date.now().toString(),
      projectName: formData.projectName.trim(),
      initialInvestment: formData.initialInvestment,
      totalReturns: formData.totalReturns,
      timeframe: formData.timeframe,
      roi: roi,
      annualizedROI: annualizedROI * 100,
      createdAt: new Date()
    };

    setCalculations(prev => [calculation, ...prev]);
    setFormData({
      projectName: '',
      initialInvestment: 0,
      totalReturns: 0,
      timeframe: 12
    });

    toast({
      title: "ROI Calculated",
      description: `ROI for "${calculation.projectName}" is ${roi.toFixed(2)}%`
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getROIStatus = (roi: number) => {
    if (roi > 50) return { color: 'text-green-600', label: 'Excellent', bg: 'bg-green-50' };
    if (roi > 20) return { color: 'text-blue-600', label: 'Good', bg: 'bg-blue-50' };
    if (roi > 0) return { color: 'text-yellow-600', label: 'Moderate', bg: 'bg-yellow-50' };
    return { color: 'text-red-600', label: 'Poor', bg: 'bg-red-50' };
  };

  const getAverageROI = () => {
    if (calculations.length === 0) return 0;
    return calculations.reduce((sum, calc) => sum + calc.roi, 0) / calculations.length;
  };

  const getTotalInvested = () => {
    return calculations.reduce((sum, calc) => sum + calc.initialInvestment, 0);
  };

  const getTotalReturns = () => {
    return calculations.reduce((sum, calc) => sum + calc.totalReturns, 0);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ROI Calculator</h1>
        <p className="text-gray-600">Calculate return on investment for your business projects</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 10 calculations maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Overview Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Portfolio Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {formatPercentage(getAverageROI())}
                </div>
                <p className="text-gray-600 text-sm">Average ROI</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(getTotalInvested())}
                  </div>
                  <div className="text-xs text-gray-600">Invested</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(getTotalReturns())}
                  </div>
                  <div className="text-xs text-gray-600">Returns</div>
                </div>
              </div>
              
              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {calculations.length}/10 calculations
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ROI Calculator */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Project name (e.g., Marketing Campaign Q1)"
                value={formData.projectName}
                onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Initial Investment</label>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={formData.initialInvestment || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, initialInvestment: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Total Returns</label>
                  <Input
                    type="number"
                    placeholder="15000"
                    value={formData.totalReturns || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalReturns: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Timeframe (months)</label>
                <Input
                  type="number"
                  placeholder="12"
                  value={formData.timeframe}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeframe: parseInt(e.target.value) || 12 }))}
                />
              </div>

              {/* Quick Preview */}
              {formData.initialInvestment > 0 && formData.totalReturns > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {formatPercentage(((formData.totalReturns - formData.initialInvestment) / formData.initialInvestment) * 100)}
                    </div>
                    <p className="text-blue-700 text-sm">Expected ROI</p>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={calculateROI} 
                className="w-full"
                disabled={calculations.length >= 10}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {calculations.length >= 10 ? 'Limit Reached' : 'Calculate ROI'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calculations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ROI Calculations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No calculations yet. Calculate your first ROI above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calculations.map((calc) => {
                const status = getROIStatus(calc.roi);
                return (
                  <div
                    key={calc.id}
                    className={`p-4 border rounded-lg ${status.bg} border-gray-200`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{calc.projectName}</h3>
                        <div className="text-sm text-gray-600">
                          {calc.createdAt.toLocaleDateString()} • {calc.timeframe} months
                        </div>
                      </div>
                      <Badge className={`${status.color} bg-transparent border-current`}>
                        {status.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Investment</div>
                        <div className="font-semibold">{formatCurrency(calc.initialInvestment)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Returns</div>
                        <div className="font-semibold">{formatCurrency(calc.totalReturns)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">ROI</div>
                        <div className={`font-semibold ${status.color}`}>
                          {formatPercentage(calc.roi)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">Annualized</div>
                        <div className={`font-semibold ${status.color}`}>
                          {formatPercentage(calc.annualizedROI)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">
                        Net Profit: {formatCurrency(calc.totalReturns - calc.initialInvestment)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need Advanced ROI Analysis?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited calculations, scenario modeling, risk analysis, and portfolio comparisons.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited calculations</Badge>
                <Badge variant="outline" className="text-xs">Pro: Scenario modeling</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Risk analysis</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ROICalculator;