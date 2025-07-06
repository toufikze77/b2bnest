import React from 'react';
import { TrendingUp, Zap, Users, DollarSign, Brain, Rocket, Target, BarChart3 } from 'lucide-react';

const AIInvestmentShowcase = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Why Investors Back <span className="text-cyan-400">B2BNest</span>
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Early-stage AI startup disrupting the $50B+ business automation market with 
            proven traction, strong unit economics, and a clear path to scale.
          </p>
        </div>

        {/* Key Investment Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-8 w-8 text-green-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">180%</div>
                <div className="text-gray-300 text-sm">YoY Growth</div>
              </div>
            </div>
            <div className="text-green-400 text-sm font-medium">Accelerating</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <DollarSign className="h-8 w-8 text-yellow-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">$420K</div>
                <div className="text-gray-300 text-sm">ARR Run Rate</div>
              </div>
            </div>
            <div className="text-yellow-400 text-sm font-medium">Growing Fast</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">8.2K</div>
                <div className="text-gray-300 text-sm">Active Users</div>
              </div>
            </div>
            <div className="text-blue-400 text-sm font-medium">Strong Traction</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <Target className="h-8 w-8 text-purple-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">$50B</div>
                <div className="text-gray-300 text-sm">Market Size</div>
              </div>
            </div>
            <div className="text-purple-400 text-sm font-medium">TAM Opportunity</div>
          </div>
        </div>

        {/* AI Competitive Advantages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-3xl font-bold text-white mb-6">
              Why We're <span className="text-cyan-400">Investment Ready</span>
            </h3>
            <div className="space-y-6">
              <div className="flex items-start">
                <Brain className="h-6 w-6 text-cyan-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Proven Product-Market Fit</div>
                  <div className="text-gray-300 text-sm">
                    8.2K+ active users with 78% monthly retention and NPS of 65. 
                    Clear demand validated with paying customers across 15+ industries.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Zap className="h-6 w-6 text-yellow-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Strong Unit Economics</div>
                  <div className="text-gray-300 text-sm">
                    CAC payback in 8 months, LTV:CAC ratio of 4.2x, and 78% gross margins. 
                    Efficient growth model ready for capital injection.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Rocket className="h-6 w-6 text-purple-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Experienced Team</div>
                  <div className="text-gray-300 text-sm">
                    Founding team with 15+ years combined experience at Google, Microsoft, and Y Combinator startups. 
                    Proven track record of building and scaling B2B SaaS products.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <h4 className="text-2xl font-bold text-white mb-6 text-center">
              Investment Highlights
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Pre-Money Valuation</span>
                <span className="text-white font-bold">$8M</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Monthly Recurring Revenue</span>
                <span className="text-green-400 font-bold">$35K</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Gross Margin</span>
                <span className="text-green-400 font-bold">78%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Monthly Burn</span>
                <span className="text-yellow-400 font-bold">$45K</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Current Runway</span>
                <span className="text-blue-400 font-bold">14 months</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-300">Customer Acquisition Cost</span>
                <span className="text-purple-400 font-bold">$280</span>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg">
                Seeking Series A: $3M
              </div>
              <div className="text-gray-300 text-sm mt-2">
                18-month runway to reach $2M ARR and profitability
              </div>
            </div>
          </div>
        </div>

        {/* Market Opportunity */}
        <div className="mt-16 text-center">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <BarChart3 className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
            <h4 className="text-2xl font-bold text-white mb-4">
              Massive Market Opportunity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">$50B</div>
                <div className="text-gray-300">Total Addressable Market</div>
                <div className="text-sm text-gray-400 mt-1">Business Process Automation</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-400 mb-2">$8B</div>
                <div className="text-gray-300">Serviceable Market</div>
                <div className="text-sm text-gray-400 mt-1">SMB Document Automation</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400 mb-2">$50M</div>
                <div className="text-gray-300">3-Year Revenue Target</div>
                <div className="text-sm text-gray-400 mt-1">Realistic Growth Trajectory</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIInvestmentShowcase;