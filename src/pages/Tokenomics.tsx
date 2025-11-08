import React from 'react';
import { Coins, PieChart, TrendingUp, Lock, Users, Zap, Target, Clock, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';
import CountdownTimer from '@/components/fundraising/CountdownTimer';
import { useCountUp } from '@/hooks/useCountUp';

const Tokenomics = () => {
  const totalSupply = useCountUp(10, 2000, 'M');
  const initialPrice = useCountUp(8, 2000, '');
  const marketCap = useCountUp(80, 2000, 'M');

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
                B2BNEST Tokenomics
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Complete guide to B2BNEST tokenomics. Learn about B2BNEST token distribution, utility, 
                and the real value of our cross-border business token in the decentralized finance ecosystem.
              </p>
            <div className="flex justify-center mb-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">{totalSupply}</div>
                <div className="text-xl text-gray-600">Total Supply</div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="max-w-2xl mx-auto">
              <CountdownTimer />
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
                        <span className="text-sm font-medium">Presale</span>
                      </div>
                      <span className="text-sm text-gray-600">30%</span>
                    </div>
                    <Progress value={30} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">Team & Advisors</span>
                      </div>
                      <span className="text-sm text-gray-600">10%</span>
                    </div>
                    <Progress value={10} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Development</span>
                      </div>
                      <span className="text-sm text-gray-600">22%</span>
                    </div>
                    <Progress value={22} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium">Marketing</span>
                      </div>
                      <span className="text-sm text-gray-600">15%</span>
                    </div>
                    <Progress value={15} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">Treasury/Liquidity</span>
                      </div>
                      <span className="text-sm text-gray-600">20%</span>
                    </div>
                    <Progress value={20} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium">Unlocked</span>
                      </div>
                      <span className="text-sm text-gray-600">3%</span>
                    </div>
                    <Progress value={3} className="h-2" />
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
              <p className="text-gray-700 mb-6">
                B2BNEST is expanding its ecosystem through strategic collaborations with leading platforms in the crypto and blockchain space. Our future partnerships aim to enhance visibility, accessibility, and real-world utility for our community. B2BNEST plans to integrate with and be listed on major partners such as <strong>DEXView</strong>, <strong>Pinksale</strong>, <strong>Birdseye</strong>, <strong>OKX</strong>, <strong>CoinGecko</strong>, <strong>CoinMarketCap</strong>, <strong>Phantom</strong>, <strong>Alchemy Pay</strong>, <strong>Binance</strong>, and <strong>Bitget</strong>.
              </p>
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