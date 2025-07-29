import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  X, 
  Shield, 
  Target, 
  Zap, 
  Users, 
  CheckCircle, 
  ArrowRight, 
  PieChart, 
  Globe, 
  Clock, 
  Star,
  Bitcoin,
  Activity
} from 'lucide-react';

import CandlestickChart from '@/components/charts/CandlestickChart';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const LiveCharts = () => {
  const [activeTab, setActiveTab] = useState<'crypto' | 'forex'>('crypto');

  return (
    <>
      <SEOHead 
        title="Live Market Charts - Crypto & Forex Trading for Business Owners | Your Platform"
        description="Join 60% of successful business owners who diversify with crypto, forex, and stocks. Real-time charts, market analysis, and investment strategies for entrepreneurs."
        keywords="business owner investment, entrepreneur crypto, forex for business owners, live market charts, investment diversification, business wealth strategy"
        canonical="/live-charts"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10">
        <div className="flex">
          {/* Main Content Area */}
          <div className="flex-1">
            <div className="container mx-auto px-4 py-8">
              {/* Hero Section */}
              <div className="text-center mb-12">
                <div className="inline-flex items-center px-4 py-2 bg-primary/10 rounded-full text-primary font-medium mb-6">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Join 60% of Successful Business Owners
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-6">
                  Diversify Your Business Wealth
                </h1>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
                  Smart entrepreneurs don't put all their eggs in one basket. Discover how over 60% of business owners 
                  are building wealth through crypto, forex, and stock investments alongside their core operations.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <div className="flex items-center px-4 py-2 bg-card border rounded-lg">
                    <Shield className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm font-medium">Inflation Protection</span>
                  </div>
                  <div className="flex items-center px-4 py-2 bg-card border rounded-lg">
                    <Target className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm font-medium">Passive Income</span>
                  </div>
                  <div className="flex items-center px-4 py-2 bg-card border rounded-lg">
                    <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="text-sm font-medium">Capital Growth</span>
                  </div>
                </div>
              </div>

              {/* Header Controls */}
              <div className="mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Live Market Data</h2>
                  <p className="text-muted-foreground mt-1">Real-time market insights for informed investment decisions</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-100">Market Cap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$2.5T</div>
                    <div className="flex items-center text-sm text-blue-100">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      +3.2% (24h)
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-100">Trading Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$89.2B</div>
                    <div className="flex items-center text-sm text-green-100">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      +12.5% (24h)
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-100">Active Markets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2,847</div>
                    <div className="flex items-center text-sm text-orange-100">
                      <Activity className="h-4 w-4 mr-1" />
                      Live tracking
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Why Business Owners Invest Section */}
              <div className="mb-16">
                <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border-0">
                  <CardContent className="p-8">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold mb-4">Why Smart Business Owners Choose Market Diversification</h2>
                      <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        Building wealth beyond your business operations isn't just smart—it's essential for long-term financial security and growth.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="text-center p-6 bg-card rounded-lg border">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
                          <Shield className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold mb-2">Inflation Protection</h3>
                        <p className="text-sm text-muted-foreground">Hedge against inflation and currency devaluation with diversified assets</p>
                      </div>
                      
                      <div className="text-center p-6 bg-card rounded-lg border">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary/10 text-secondary rounded-lg mb-4">
                          <DollarSign className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold mb-2">Passive Income</h3>
                        <p className="text-sm text-muted-foreground">Generate income streams that work while you focus on your business</p>
                      </div>
                      
                      <div className="text-center p-6 bg-card rounded-lg border">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 text-accent rounded-lg mb-4">
                          <TrendingUp className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold mb-2">Capital Growth</h3>
                        <p className="text-sm text-muted-foreground">Compound your wealth with strategic market investments</p>
                      </div>
                      
                      <div className="text-center p-6 bg-card rounded-lg border">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/10 text-green-600 rounded-lg mb-4">
                          <Target className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold mb-2">Financial Security</h3>
                        <p className="text-sm text-muted-foreground">Build multiple income sources for long-term stability</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Chart Area */}
              <div className="mb-16">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-8 w-8 text-primary" />
                    Live Market Charts
                  </h2>
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'crypto' | 'forex')}>
                    <TabsList className="bg-background">
                      <TabsTrigger value="crypto" className="flex items-center gap-2">
                        <Bitcoin className="h-4 w-4" />
                        Cryptocurrency
                      </TabsTrigger>
                      <TabsTrigger value="forex" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Foreign Exchange
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'crypto' | 'forex')}>
                  <TabsContent value="crypto" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CandlestickChart 
                        symbol="bitcoin" 
                        type="crypto" 
                        title="Bitcoin (BTC/USD)"
                      />
                      <CandlestickChart 
                        symbol="ethereum" 
                        type="crypto" 
                        title="Ethereum (ETH/USD)"
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CandlestickChart 
                        symbol="binancecoin" 
                        type="crypto" 
                        title="Binance Coin (BNB/USD)"
                      />
                      <CandlestickChart 
                        symbol="solana" 
                        type="crypto" 
                        title="Solana (SOL/USD)"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="forex" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CandlestickChart 
                        symbol="EUR/USD" 
                        type="forex" 
                        title="Euro vs US Dollar (EUR/USD)"
                      />
                      <CandlestickChart 
                        symbol="GBP/USD" 
                        type="forex" 
                        title="British Pound vs US Dollar (GBP/USD)"
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CandlestickChart 
                        symbol="USD/JPY" 
                        type="forex" 
                        title="US Dollar vs Japanese Yen (USD/JPY)"
                      />
                      <CandlestickChart 
                        symbol="AUD/USD" 
                        type="forex" 
                        title="Australian Dollar vs US Dollar (AUD/USD)"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Investment Strategies Section */}
              <div className="mb-16">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-4">Investment Strategies for Busy Entrepreneurs</h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Time-tested approaches that work for business owners who want to build wealth without compromising their core operations.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
                    <CardHeader className="relative">
                      <div className="flex items-center mb-4">
                        <Clock className="h-8 w-8 text-primary mr-3" />
                        <div>
                          <CardTitle className="text-xl">Dollar-Cost Averaging</CardTitle>
                          <p className="text-sm text-muted-foreground">Perfect for busy schedules</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Invest fixed amounts regularly</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Reduces timing risk</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Automate your investments</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Build discipline over time</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent"></div>
                    <CardHeader className="relative">
                      <div className="flex items-center mb-4">
                        <PieChart className="h-8 w-8 text-secondary mr-3" />
                        <div>
                          <CardTitle className="text-xl">Portfolio Diversification</CardTitle>
                          <p className="text-sm text-muted-foreground">Spread risk intelligently</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />70% stable assets (stocks, bonds)</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />20% growth assets (crypto)</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />10% forex hedging</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Rebalance quarterly</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent"></div>
                    <CardHeader className="relative">
                      <div className="flex items-center mb-4">
                        <Globe className="h-8 w-8 text-accent mr-3" />
                        <div>
                          <CardTitle className="text-xl">Global Opportunities</CardTitle>
                          <p className="text-sm text-muted-foreground">Think beyond borders</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative">
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />International stock markets</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Currency pair trading</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Emerging market exposure</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />24/7 market access</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Success Stories Section */}
              <div className="mb-16">
                <Card className="bg-gradient-to-br from-background to-card border shadow-lg">
                  <CardContent className="p-8">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-foreground mb-4">Success Stories from Business Owners</h2>
                      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Real results from entrepreneurs who diversified their wealth strategically
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-background p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center mb-4">
                          <Star className="h-5 w-5 text-yellow-500 mr-2" />
                          <span className="font-semibold">Sarah M. - E-commerce Owner</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          "Started with 5% of profits in crypto DCA. After 2 years, my side investments 
                          match 40% of my business income. Game-changer for financial security."
                        </p>
                        <div className="flex items-center text-sm">
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-600 font-medium">340% Portfolio Growth</span>
                        </div>
                      </div>
                      
                      <div className="bg-background p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center mb-4">
                          <Star className="h-5 w-5 text-yellow-500 mr-2" />
                          <span className="font-semibold text-foreground">Michael T. - Consulting Firm</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          "Forex hedging protected my international revenues during currency volatility. 
                          Diversification saved me from significant losses in 2023."
                        </p>
                        <div className="flex items-center text-sm">
                          <Shield className="h-4 w-4 text-blue-500 mr-1" />
                          <span className="text-blue-600 font-medium">Risk Mitigation Success</span>
                        </div>
                      </div>
                      
                      <div className="bg-background p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center mb-4">
                          <Star className="h-5 w-5 text-yellow-500 mr-2" />
                          <span className="font-semibold text-foreground">Lisa R. - Tech Startup</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          "Automated investing in index funds and crypto gave me passive income streams. 
                          Now I reinvest gains back into scaling my startup."
                        </p>
                        <div className="flex items-center text-sm">
                          <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-600 font-medium">Passive Income Achieved</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Market Education Section */}
              <div className="mb-16">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-4">Why These Markets Matter for Business Owners</h2>
                  <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                    Understanding the unique advantages each market offers helps you make informed investment decisions.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-center mb-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg mr-4">
                          <Zap className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                          <CardTitle>Cryptocurrency</CardTitle>
                          <p className="text-sm text-muted-foreground">Digital Asset Revolution</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>24/7 Trading:</strong> Perfect for busy schedules</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Institutional Adoption:</strong> Major companies now hold crypto</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Inflation Hedge:</strong> Digital gold for modern portfolios</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>High Growth Potential:</strong> Early adoption advantages</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-center mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg mr-4">
                          <Globe className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle>Foreign Exchange</CardTitle>
                          <p className="text-sm text-muted-foreground">Global Currency Markets</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Largest Market:</strong> $7.5 trillion daily volume</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Currency Hedging:</strong> Protect international business</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Lower Volatility:</strong> More predictable than crypto</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Economic Indicators:</strong> Trade on global events</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-center mb-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg mr-4">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <CardTitle>Stock Markets</CardTitle>
                          <p className="text-sm text-muted-foreground">Traditional Wealth Building</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Dividend Income:</strong> Regular passive income streams</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Company Ownership:</strong> Share in business success</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Historical Performance:</strong> Long-term wealth creation</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span><strong>Index Funds:</strong> Diversified, low-maintenance options</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Market Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
                <Card>
                  <CardHeader>
                    <CardTitle>Market Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div>
                          <div className="font-medium text-green-800">Bullish Trend</div>
                          <div className="text-sm text-green-600">Strong upward momentum</div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                      </div>
                      <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <div>
                          <div className="font-medium text-blue-800">High Volume</div>
                          <div className="text-sm text-blue-600">Increased trading activity</div>
                        </div>
                        <Activity className="h-8 w-8 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Movers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <Bitcoin className="h-4 w-4 text-orange-600" />
                          </div>
                          <span className="font-medium">Bitcoin</span>
                        </div>
                        <div className="flex items-center text-green-600">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          +5.2%
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Globe className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium">EUR/USD</span>
                        </div>
                        <div className="flex items-center text-green-600">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          +0.8%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Call to Action Section */}
              <div className="mb-16">
                <Card className="bg-gradient-to-br from-primary/90 via-secondary/90 to-accent/90 backdrop-blur-sm border shadow-xl">
                  <CardContent className="p-8 text-center">
                    <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-sm">Ready to Start Your Investment Journey?</h2>
                    <p className="text-lg mb-8 text-white/95 max-w-2xl mx-auto drop-shadow-sm">
                      Join thousands of business owners who are already building wealth through smart market diversification. 
                      Start small, think long-term, and let compound growth work for you.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                      <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 shadow-lg">
                        <Users className="h-5 w-5 mr-2" />
                        Join Our Community
                      </Button>
                      <Button size="lg" variant="outline" className="border-white/80 text-white hover:bg-white/20 backdrop-blur-sm">
                        <ArrowRight className="h-5 w-5 mr-2" />
                        Explore Investment Tools
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/30">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white drop-shadow-sm">60%</div>
                        <div className="text-sm text-white/90">Business Owners Investing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white drop-shadow-sm">$2.1T</div>
                        <div className="text-sm text-white/90">Global Market Cap</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white drop-shadow-sm">24/7</div>
                        <div className="text-sm text-white/90">Market Access</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Educational Disclaimer */}
              <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                    <Shield className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-2">Investment Disclaimer</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The information provided on this page is for educational purposes only and should not be considered financial advice. 
                      All investments carry risk, including potential loss of principal. Past performance does not guarantee future results. 
                      Consult with qualified financial advisors before making investment decisions. Market data is provided for informational 
                      purposes and may be delayed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
        <Footer />
      </div>
    </>
  );
};

export default LiveCharts;