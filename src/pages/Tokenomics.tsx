import React from 'react';
import { Coins, PieChart, TrendingUp, Lock, Users, Zap, Target, Clock, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Footer from '@/components/Footer';
import TokenSEO from '@/components/TokenSEO';
import CountdownTimer from '@/components/fundraising/CountdownTimer';
import { useCountUp } from '@/hooks/useCountUp';
import { Pie, PieChart as RechartsePie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const Tokenomics = () => {
  const totalSupply = useCountUp(10, 2000, 'M');
  const initialPrice = useCountUp(8, 2000, '');
  const marketCap = useCountUp(80, 2000, 'M');

  const distributionData = [
    { name: 'Presale', value: 30, color: '#a855f7' },
    { name: 'Team & Advisors', value: 10, color: '#3b82f6' },
    { name: 'Development', value: 22, color: '#10b981' },
    { name: 'Marketing', value: 15, color: '#f97316' },
    { name: 'Treasury/Liquidity', value: 20, color: '#ef4444' },
    { name: 'Unlocked', value: 3, color: '#eab308' },
  ];

  const chartConfig = {
    value: {
      label: "Percentage",
    },
  };

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

          {/* ERC-20 Standard Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  ERC-20 Token Standard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-6">
                  The B2BN token is built on the <strong>ERC-20 standard</strong>, the most widely adopted token protocol on the Ethereum blockchain. This ensures maximum compatibility, security, and accessibility for our users.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Lock className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Battle-Tested Security</h4>
                      <p className="text-sm text-gray-600">Proven security model used by thousands of projects with billions in market cap</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Universal Compatibility</h4>
                      <p className="text-sm text-gray-600">Supported by all major wallets including MetaMask, Trust Wallet, and Coinbase Wallet</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Enhanced Liquidity</h4>
                      <p className="text-sm text-gray-600">Easy listing on major exchanges and DEXs like Uniswap, SushiSwap, and centralized platforms</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <Target className="h-5 w-5 text-orange-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">DeFi Integration</h4>
                      <p className="text-sm text-gray-600">Seamless integration with DeFi protocols for staking, lending, and yield farming</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-red-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Smart Contract Functionality</h4>
                      <p className="text-sm text-gray-600">Full programmable capabilities for automated transactions and business logic</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Transparent & Auditable</h4>
                      <p className="text-sm text-gray-600">All transactions are publicly verifiable on the Ethereum blockchain</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <p className="text-sm text-gray-700">
                    <strong>Why ERC-20 matters:</strong> By adhering to this industry-standard protocol, B2BN tokens benefit from established infrastructure, reduced integration costs, and instant compatibility with the broader Ethereum ecosystem—ensuring long-term viability and adoption.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security & Compliance */}
          <div className="max-w-4xl mx-auto mb-16">
            <Card className="border-2 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-600" />
                  Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-6">
                  B2BN token prioritizes security and transparency. Our smart contract has undergone rigorous auditing and our team has completed KYC verification to ensure trust and compliance.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                        <Lock className="h-6 w-6 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900 text-lg">Smart Contract Audited</h4>
                    </div>
                    <p className="text-sm text-gray-700">
                      Our ERC-20 smart contract has been professionally audited by leading blockchain security firms to identify and eliminate potential vulnerabilities, ensuring your investment is protected.
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900 text-lg">KYC Verified</h4>
                    </div>
                    <p className="text-sm text-gray-700">
                      The B2BNest team has successfully completed Know Your Customer (KYC) verification, providing full transparency and accountability to our community and investors.
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-100">
                  <p className="text-sm text-gray-700 text-center">
                    <strong>Your Security is Our Priority:</strong> These measures demonstrate our commitment to operating with the highest standards of security, transparency, and regulatory compliance in the blockchain space.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partner Exchanges & Platforms */}
          <div className="max-w-6xl mx-auto mb-16">
            <Card className="border border-border bg-background shadow-lg">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-3xl font-bold mb-3">Partner Exchanges & Platforms</CardTitle>
                <p className="text-muted-foreground text-base">B2BN will be listed on leading exchanges and tracked by major crypto data platforms</p>
              </CardHeader>
              <CardContent className="px-8 pb-10">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-12 items-center justify-items-center mb-10">
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/pinksale-logo.png" 
                      alt="PinkSale - Token Launchpad Platform" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/coingecko-logo.png" 
                      alt="CoinGecko - Crypto Market Data" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/coinmarketcap-logo.png" 
                      alt="CoinMarketCap - Crypto Price Tracking" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/dexview-logo.png" 
                      alt="DEXView - DEX Analytics" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/birdseye-logo.png" 
                      alt="BirdsEye - Solana Analytics" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/okx-logo.png" 
                      alt="OKX - Crypto Exchange" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/binance-logo.png" 
                      alt="Binance - Leading Crypto Exchange" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/bitget-logo.png" 
                      alt="Bitget - Crypto Exchange Platform" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/alchemypay-logo.png" 
                      alt="Alchemy Pay - Crypto Payment Gateway" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-center h-20">
                    <img 
                      src="/logos/phantom-logo.png" 
                      alt="Phantom - Solana Wallet" 
                      className="h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-6 border border-border">
                  <p className="text-sm text-foreground text-center leading-relaxed">
                    <strong className="text-primary">Wide Accessibility:</strong> B2BN will be available on multiple major exchanges and tracked across leading crypto data platforms, ensuring maximum liquidity and transparency for all token holders.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token Distribution */}
          <div className="max-w-3xl mx-auto mb-16">
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
          </div>

          {/* Distribution Chart */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <PieChart className="h-6 w-6 text-purple-600" />
                Token Distribution Chart
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ChartContainer config={chartConfig} className="h-[500px] w-full max-w-4xl">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsePie>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={140}
                      fill="#8884d8"
                      dataKey="value"
                      style={{ fontSize: '16px', fontWeight: '500' }}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: '16px', paddingTop: '20px' }} />
                  </RechartsePie>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

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