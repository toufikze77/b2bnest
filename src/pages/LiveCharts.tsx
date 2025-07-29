import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Bitcoin, Globe, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import CryptoPriceSidebar from '@/components/sidebars/CryptoPriceSidebar';
import ForexPriceSidebar from '@/components/sidebars/ForexPriceSidebar';
import Footer from '@/components/Footer';

const LiveCharts = () => {
  const [activeTab, setActiveTab] = useState<'crypto' | 'forex'>('crypto');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex">
        {/* Main Content Area */}
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'mr-80' : 'mr-0'}`}>
          <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Live Market Charts</h1>
                <p className="text-lg text-gray-600">Real-time cryptocurrency and forex market data</p>
              </div>
              <Button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                {sidebarOpen ? 'Hide Sidebar' : 'Show Live Prices'}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

            {/* Main Chart Area */}
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Live Market Charts
                  </CardTitle>
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'crypto' | 'forex')}>
                    <TabsList>
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
              </CardHeader>
              <CardContent>
                <div className="min-h-[500px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                  {activeTab === 'crypto' ? (
                    <div className="text-center">
                      <Bitcoin className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Cryptocurrency Charts</h3>
                      <p className="text-gray-600 mb-4">Advanced trading charts with real-time data</p>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>• Candlestick charts</div>
                        <div>• Volume indicators</div>
                        <div>• Technical analysis</div>
                        <div>• Price alerts</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Globe className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Forex Market Charts</h3>
                      <p className="text-gray-600 mb-4">Real-time foreign exchange rate charts</p>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>• Major currency pairs</div>
                        <div>• Live spreads</div>
                        <div>• Market trends</div>
                        <div>• Economic indicators</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Market Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Market Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium text-green-800">Bullish Trend</div>
                        <div className="text-sm text-green-600">Strong upward momentum</div>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
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
                      <div className="flex items-center text-red-600">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        -0.8%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Sticky Sidebar */}
        {sidebarOpen && (
          <div className="fixed right-0 top-16 w-80 h-[calc(100vh-4rem)] bg-background border-l border-border shadow-xl z-30 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Live Market Prices</h2>
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'crypto' | 'forex')} className="h-full">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
                <TabsTrigger value="crypto" className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4" />
                  Crypto
                </TabsTrigger>
                <TabsTrigger value="forex" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Forex
                </TabsTrigger>
              </TabsList>
              <TabsContent value="crypto" className="mt-4 h-full overflow-hidden">
                <CryptoPriceSidebar />
              </TabsContent>
              <TabsContent value="forex" className="mt-4 h-full overflow-hidden">
                <ForexPriceSidebar />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default LiveCharts;