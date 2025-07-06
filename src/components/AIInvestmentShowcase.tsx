import React from 'react';
import { TrendingUp, Zap, Users, DollarSign, Brain, Rocket, Target, BarChart3 } from 'lucide-react';

const AIInvestmentShowcase = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Why Investors Choose <span className="text-cyan-400">B2BNest</span>
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            The only AI-native business automation platform capturing the $50B+ enterprise software market 
            with unprecedented growth metrics and scalable technology.
          </p>
        </div>

        {/* Key Investment Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-8 w-8 text-green-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">300%</div>
                <div className="text-gray-300 text-sm">Annual Growth</div>
              </div>
            </div>
            <div className="text-green-400 text-sm font-medium">Industry Leading</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <DollarSign className="h-8 w-8 text-yellow-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">$2.5M</div>
                <div className="text-gray-300 text-sm">ARR Achieved</div>
              </div>
            </div>
            <div className="text-yellow-400 text-sm font-medium">Recurring Revenue</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <div className="text-2xl font-bold text-white">85%</div>
                <div className="text-gray-300 text-sm">Retention Rate</div>
              </div>
            </div>
            <div className="text-blue-400 text-sm font-medium">Customer Loyalty</div>
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
              AI-First <span className="text-cyan-400">Competitive Moat</span>
            </h3>
            <div className="space-y-6">
              <div className="flex items-start">
                <Brain className="h-6 w-6 text-cyan-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Proprietary AI Engine</div>
                  <div className="text-gray-300 text-sm">
                    Advanced machine learning algorithms that generate context-aware business documents 
                    with 95% accuracy, creating defensible IP barriers.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Zap className="h-6 w-6 text-yellow-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Automation at Scale</div>
                  <div className="text-gray-300 text-sm">
                    Processing 1M+ documents monthly with zero human intervention, 
                    enabling exponential scaling without proportional cost increases.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Rocket className="h-6 w-6 text-purple-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Viral Growth Loop</div>
                  <div className="text-gray-300 text-sm">
                    Network effects drive 40% of new signups through referrals, 
                    reducing CAC by 60% while accelerating market penetration.
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
                <span className="text-gray-300">Current Valuation</span>
                <span className="text-white font-bold">$25M</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Revenue Multiple</span>
                <span className="text-green-400 font-bold">10x ARR</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Gross Margin</span>
                <span className="text-green-400 font-bold">92%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Burn Rate</span>
                <span className="text-yellow-400 font-bold">$120K/mo</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-300">Runway</span>
                <span className="text-blue-400 font-bold">18 months</span>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg">
                Seeking Series A: $5M
              </div>
              <div className="text-gray-300 text-sm mt-2">
                To accelerate AI development and market expansion
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
                <div className="text-3xl font-bold text-purple-400 mb-2">$12B</div>
                <div className="text-gray-300">Serviceable Market</div>
                <div className="text-sm text-gray-400 mt-1">SMB Document Automation</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400 mb-2">$500M</div>
                <div className="text-gray-300">Immediate Opportunity</div>
                <div className="text-sm text-gray-400 mt-1">5-Year Revenue Target</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIInvestmentShowcase;