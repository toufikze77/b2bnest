import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Wallet, DollarSign, Users, Clock, Shield, Play, Star, TrendingUp, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Fundraising = () => {
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [timeLeft, setTimeLeft] = useState({
    days: 15,
    hours: 8,
    minutes: 42,
    seconds: 18
  });

  // Mock presale data
  const presaleData = {
    tokenName: 'B2BNest Token',
    tokenSymbol: 'B2BN',
    totalSupply: '100,000,000',
    presalePrice: '0.0001',
    currentRaised: '245.8',
    hardCap: '500',
    softCap: '100',
    minContribution: '0.1',
    maxContribution: '10',
    participants: 1247,
    progress: 49.16
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleEthChange = (value: string) => {
    setEthAmount(value);
    if (value) {
      const tokens = (parseFloat(value) / parseFloat(presaleData.presalePrice)).toFixed(0);
      setTokenAmount(tokens);
    } else {
      setTokenAmount('');
    }
  };

  const connectWallet = async () => {
    try {
      // Mock wallet connection
      setIsConnected(true);
      setWalletAddress('0x742d35Cc6634C0532925a3b8D9C9C4d74b3B2A8d');
      toast({
        title: "Wallet Connected",
        description: "Your wallet has been connected successfully."
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePurchase = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive"
      });
      return;
    }

    if (!ethAmount || parseFloat(ethAmount) < parseFloat(presaleData.minContribution)) {
      toast({
        title: "Invalid Amount",
        description: `Minimum contribution is ${presaleData.minContribution} ETH.`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Mock purchase transaction
      toast({
        title: "Transaction Submitted",
        description: "Your purchase transaction has been submitted to the blockchain."
      });
      
      // Reset form
      setEthAmount('');
      setTokenAmount('');
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description: "Failed to submit transaction. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {presaleData.tokenName} Presale
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Join the future of B2B document management platform
          </p>
          <div className="flex items-center justify-center space-x-2 mb-8">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Shield className="h-4 w-4 mr-1" />
              Audited by PinkFinance
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Fair Launch
            </Badge>
          </div>
        </div>

        {/* Video Explanation Section */}
        <div className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-center justify-center">
                <Play className="h-6 w-6 mr-2 text-blue-600" />
                How to Invest & Early Investor Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Video Placeholder */}
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-300">
                    <div className="text-center">
                      <Play className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">Investment Tutorial Video</h3>
                      <p className="text-sm text-blue-600">Learn how to participate in our presale</p>
                      <Button className="mt-4" size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Watch Tutorial
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Benefits List */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Early Investor Benefits</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-yellow-100 p-2 rounded-full">
                        <Star className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Exclusive Presale Price</h4>
                        <p className="text-sm text-gray-600">Get B2BN tokens at 0.0001 ETH - 50% lower than public launch price</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Revenue Sharing</h4>
                        <p className="text-sm text-gray-600">Earn 15% of platform revenue distributed quarterly to token holders</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <Zap className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Premium Features Access</h4>
                        <p className="text-sm text-gray-600">Lifetime access to AI-powered document analysis and premium templates</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Governance Rights</h4>
                        <p className="text-sm text-gray-600">Vote on platform decisions and new feature development</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">🚀 Limited Time Bonus</h4>
                    <p className="text-sm text-blue-800">First 500 investors receive an additional 20% bonus tokens!</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Presale Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Countdown Timer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Presale Ends In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{timeLeft.days}</div>
                    <div className="text-sm text-gray-600">Days</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{timeLeft.hours}</div>
                    <div className="text-sm text-gray-600">Hours</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{timeLeft.minutes}</div>
                    <div className="text-sm text-gray-600">Minutes</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{timeLeft.seconds}</div>
                    <div className="text-sm text-gray-600">Seconds</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Presale Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Raised: {presaleData.currentRaised} ETH</span>
                    <span>Hard Cap: {presaleData.hardCap} ETH</span>
                  </div>
                  <Progress value={presaleData.progress} className="h-3" />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Soft Cap: {presaleData.softCap} ETH</span>
                    <span>{presaleData.progress.toFixed(1)}% Complete</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Information */}
            <Card>
              <CardHeader>
                <CardTitle>Token Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Token Name</Label>
                    <p className="text-lg font-semibold">{presaleData.tokenName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Symbol</Label>
                    <p className="text-lg font-semibold">{presaleData.tokenSymbol}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Total Supply</Label>
                    <p className="text-lg font-semibold">{presaleData.totalSupply}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Presale Price</Label>
                    <p className="text-lg font-semibold">{presaleData.presalePrice} ETH</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Purchase Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Purchase Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected ? (
                  <Button onClick={connectWallet} className="w-full" size="lg">
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Wallet
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="eth-amount">ETH Amount</Label>
                      <Input
                        id="eth-amount"
                        type="number"
                        placeholder="0.0"
                        value={ethAmount}
                        onChange={(e) => handleEthChange(e.target.value)}
                        min={presaleData.minContribution}
                        max={presaleData.maxContribution}
                        step="0.001"
                      />
                      <p className="text-xs text-gray-500">
                        Min: {presaleData.minContribution} ETH, Max: {presaleData.maxContribution} ETH
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="token-amount">You will receive</Label>
                      <Input
                        id="token-amount"
                        type="text"
                        value={tokenAmount ? `${tokenAmount} ${presaleData.tokenSymbol}` : ''}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>

                    <Button onClick={handlePurchase} className="w-full" size="lg">
                      Purchase Tokens
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Presale Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Participants</span>
                    <span className="font-semibold">{presaleData.participants.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Funds Raised</span>
                    <span className="font-semibold">{presaleData.currentRaised} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-semibold text-green-600">{presaleData.progress.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PinkFinance Link */}
            <Card>
              <CardContent className="pt-6">
                <Button variant="outline" className="w-full" asChild>
                  <a href="https://www.pinksale.finance" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on PinkFinance
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Important Disclaimer</h3>
          <p className="text-sm text-yellow-700">
            Cryptocurrency investments are subject to high market risk. Please make your investments cautiously. 
            B2BNest will not be responsible for your investment losses. The information provided is not investment advice.
            Always do your own research before investing.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Fundraising;
