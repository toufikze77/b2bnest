
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PurchasePanelProps {
  presalePrice: string;
  tokenSymbol: string;
  minContribution: string;
  maxContribution: string;
}

const PurchasePanel = ({ presalePrice, tokenSymbol, minContribution, maxContribution }: PurchasePanelProps) => {
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const handleEthChange = (value: string) => {
    setEthAmount(value);
    if (value) {
      const tokens = (parseFloat(value) / parseFloat(presalePrice)).toFixed(0);
      setTokenAmount(tokens);
    } else {
      setTokenAmount('');
    }
  };

  const connectWallet = async () => {
    try {
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

    if (!ethAmount || parseFloat(ethAmount) < parseFloat(minContribution)) {
      toast({
        title: "Invalid Amount",
        description: `Minimum contribution is ${minContribution} ETH.`,
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Transaction Submitted",
        description: "Your purchase transaction has been submitted to the blockchain."
      });
      
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
                min={minContribution}
                max={maxContribution}
                step="0.001"
              />
              <p className="text-xs text-gray-500">
                Min: {minContribution} ETH, Max: {maxContribution} ETH
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-amount">You will receive</Label>
              <Input
                id="token-amount"
                type="text"
                value={tokenAmount ? `${tokenAmount} ${tokenSymbol}` : ''}
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
  );
};

export default PurchasePanel;
