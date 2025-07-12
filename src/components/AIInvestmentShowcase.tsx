import React from 'react';
import { TrendingUp, Zap, Users, DollarSign, Brain, Rocket, Target, BarChart3 } from 'lucide-react';

const AIInvestmentShowcase = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Amazing Business Tools for <span className="text-cyan-400">Everyone</span>
          </h2>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            From startups to big businesses, our AI-powered platform delivers comprehensive business automation tools. 
            Built on cutting-edge AI technology and powered by our own Ethereum-based token B2BN for seamless transactions.
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
              Why Our <span className="text-cyan-400">AI Platform Stands Out</span>
            </h3>
            <div className="space-y-6">
              <div className="flex items-start">
                <Brain className="h-6 w-6 text-cyan-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">AI-Powered Business Suite</div>
                  <div className="text-gray-300 text-sm">
                    Complete business automation from CRM and project management to document generation and invoicing. 
                    AI intelligence optimizes workflows for startups and enterprises alike.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Zap className="h-6 w-6 text-yellow-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">B2BN Token Integration</div>
                  <div className="text-gray-300 text-sm">
                    Our Ethereum-based B2BN token powers seamless business transactions, smart contracts, 
                    and premium feature access across the entire platform ecosystem.
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <Rocket className="h-6 w-6 text-purple-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold mb-2">Scalable for All Business Sizes</div>
                  <div className="text-gray-300 text-sm">
                    From solo entrepreneurs to Fortune 500 companies, our platform scales dynamically. 
                    Proven success across 8.2K+ businesses in 15+ industries worldwide.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <h4 className="text-2xl font-bold text-white mb-6 text-center">
              Platform Highlights
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">AI-Powered Tools</span>
                <span className="text-white font-bold">25+</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Active Business Users</span>
                <span className="text-green-400 font-bold">8.2K+</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">B2BN Token Integration</span>
                <span className="text-green-400 font-bold">Ethereum</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">Industries Served</span>
                <span className="text-yellow-400 font-bold">15+</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-300">User Retention Rate</span>
                <span className="text-blue-400 font-bold">78%</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-300">Platform Uptime</span>
                <span className="text-purple-400 font-bold">99.9%</span>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg">
                Powered by B2BN Token
              </div>
              <div className="text-gray-300 text-sm mt-2">
                Ethereum-based ecosystem for seamless business operations
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