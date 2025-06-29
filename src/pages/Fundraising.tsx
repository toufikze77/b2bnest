
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Wallet, DollarSign, Users, Clock, Shield } from 'lucide-react';
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
