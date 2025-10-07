import React from 'react';
import { Coins, PieChart, TrendingUp, Lock, Users, Zap, Target, Clock, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';

const Tokenomics = () => {
  return (
    <>
      <TokenSEO page="tokenomics" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="pt-20 pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center p-2 bg-purple-100 rounded-full mb-6">
                <Coins className="h-8 w-8 text-purple-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-6">
                B2BNEST Tokenomics | Staking & Yield Farming
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Complete guide to B2BNEST tokenomics. Learn about staking B2BNEST token rewards, yield farming opportunities, 
                and the real utility of our cross-border business token in the decentralized finance ecosystem.
              </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">1B</div>
                <div className="text-gray-600">Total Supply</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">$0.08</div>
                <div className="text-gray-600">Initial Price</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">$80M</div>
                <div className="text-gray-600">Market Cap</div>
              </div>
            </div>
          </div>

          {/* Token Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  Token Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium">Community & Ecosystem</span>
                      </div>
                      <span className="text-sm text-gray-600">35%</span>
                    </div>
                    <Progress value={35} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">350M B2BN</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">Team & Advisors</span>
                      </div>
                      <span className="text-sm text-gray-600">20%</span>
                    </div>
                    <Progress value={20} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">200M B2BN (4-year vesting)</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Public Sale</span>
                      </div>
                      <span className="text-sm text-gray-600">15%</span>
                    </div>
                    <Progress value={15} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">150M B2BN</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium">Private Sale</span>
                      </div>
                      <span className="text-sm text-gray-600">12%</span>
                    </div>
                    <Progress value={12} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">120M B2BN</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">Liquidity & Exchange</span>
                      </div>
                      <span className="text-sm text-gray-600">10%</span>
                    </div>
                    <Progress value={10} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">100M B2BN</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium">Reserve Fund</span>
                      </div>
                      <span className="text-sm text-gray-600">8%</span>
                    </div>
                    <Progress value={8} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">80M B2BN</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Release Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-l-4 border-green-500 pl-4">
                    <div className="font-semibold text-gray-900">Token Generation Event (TGE)</div>
                    <div className="text-sm text-gray-600 mt-1">25% of total supply released</div>
                    <div className="text-xs text-green-600 mt-1">Q1 2025</div>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="font-semibold text-gray-900">Monthly Vesting</div>
                    <div className="text-sm text-gray-600 mt-1">Linear release over 36 months</div>
                    <div className="text-xs text-blue-600 mt-1">Starting Q2 2025</div>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <div className="font-semibold text-gray-900">Team Cliff</div>
                    <div className="text-sm text-gray-600 mt-1">12-month cliff, then 36-month vesting</div>
                    <div className="text-xs text-purple-600 mt-1">Starting Q1 2026</div>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <div className="font-semibold text-gray-900">Ecosystem Rewards</div>
                    <div className="text-sm text-gray-600 mt-1">Gradual release based on milestones</div>
                    <div className="text-xs text-orange-600 mt-1">Ongoing</div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">Circulating Supply Projection</div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">250M</div>
                      <div className="text-xs text-gray-600">Year 1</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">550M</div>
                      <div className="text-xs text-gray-600">Year 2</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">850M</div>
                      <div className="text-xs text-gray-600">Year 3</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token Utility */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Token Utility & Use Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <Target className="h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Platform Access</h3>
                  <p className="text-sm text-gray-600">Pay for premium AI document processing and automation services</p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Governance</h3>
                  <p className="text-sm text-gray-600">Vote on platform upgrades, feature requests, and community proposals</p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Staking Rewards</h3>
                  <p className="text-sm text-gray-600">Stake tokens to earn rewards and unlock premium features</p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                  <Lock className="h-8 w-8 text-orange-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Enterprise Licensing</h3>
                  <p className="text-sm text-gray-600">Enterprise customers pay in B2BN for advanced AI capabilities</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Economics Model */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Deflationary Mechanism
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Quarterly Burn</span>
                    <span className="font-medium text-red-600">2% of Revenue</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Transaction Fees</span>
                    <span className="font-medium text-orange-600">0.5% Burned</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Max Supply Reduction</span>
                    <span className="font-medium text-purple-600">50% over 10 years</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Revenue Sharing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Staker Rewards</span>
                    <span className="font-medium text-green-600">30% of Revenue</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Development Fund</span>
                    <span className="font-medium text-blue-600">40% of Revenue</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Community Treasury</span>
                    <span className="font-medium text-purple-600">20% of Revenue</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Staking Tiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900">Bronze Tier</div>
                    <div className="text-sm text-gray-600">1,000+ B2BN • 5% APY</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="font-medium text-blue-900">Silver Tier</div>
                    <div className="text-sm text-blue-600">10,000+ B2BN • 8% APY</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-medium text-purple-900">Gold Tier</div>
                    <div className="text-sm text-purple-600">50,000+ B2BN • 12% APY</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Future Partnerships */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5 text-blue-600" />
                🔗 Future Partnerships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-8">
                B2BNEST is expanding its ecosystem through strategic collaborations with leading platforms in the crypto and blockchain space. Our future partnerships aim to enhance visibility, accessibility, and real-world utility for our community.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/binance-logo.png" alt="Binance" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/okx-logo.png" alt="OKX" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/coingecko-logo.png" alt="CoinGecko" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/coinmarketcap-logo.png" alt="CoinMarketCap" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/bitget-logo.png" alt="Bitget" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/phantom-logo.png" alt="Phantom" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/pinksale-logo.png" alt="PinkSale" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/dexview-logo.png" alt="DEXView" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/birdseye-logo.png" alt="Birdseye" className="h-12 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-shadow">
                  <img src="/partners/alchemypay-logo.png" alt="Alchemy Pay" className="h-12 w-auto object-contain" />
                </div>
              </div>

              <p className="text-gray-700">
                These partnerships will strengthen our liquidity, transparency, and multi-chain presence — empowering users with seamless trading, analytics, and global payment options as we continue to grow in the decentralized finance ecosystem.
              </p>
            </CardContent>
          </Card>

          {/* Call to Action */}
          <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardContent className="text-center py-12">
              <Coins className="h-16 w-16 mx-auto mb-6 opacity-90" />
              <h3 className="text-2xl font-bold mb-4">Join the B2BNest Token Economy</h3>
              <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
                Be part of the future of business automation. Early adopters get exclusive access 
                to presale pricing and bonus rewards.
              </p>
              <div className="flex justify-center gap-4">
                <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                  Join Presale
                </button>
                <button className="px-8 py-3 border border-white text-white rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors">
                  View Roadmap
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  </>
  );
};

export default Tokenomics;