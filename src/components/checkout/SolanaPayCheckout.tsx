
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Wallet, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SolanaPayCheckoutProps {
  amount: number;
  itemName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const SolanaPayCheckout = ({
  amount,
  itemName,
  onSuccess,
  onError,
  onCancel
}: SolanaPayCheckoutProps) => {
  const [walletAddress] = useState('AIPlatformSolanaWalletAddress123456789'); // Replace with actual wallet
  const [solanaAmount, setSolanaAmount] = useState<number>(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Convert GBP to SOL (mock conversion rate)
    const solToGbpRate = 85; // Approximate rate, should be fetched from API
    const convertedAmount = amount / solToGbpRate;
    setSolanaAmount(convertedAmount);

    // Generate QR code URL for Solana Pay
    const solanaPayUrl = `solana:${walletAddress}?amount=${convertedAmount}&label=${encodeURIComponent(itemName)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(solanaPayUrl)}`;
    setQrCodeUrl(qrUrl);
  }, [amount, itemName, walletAddress]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const connectPhantomWallet = async () => {
    setIsConnecting(true);
    try {
      // Check if Phantom wallet is available
      const isPhantomInstalled = window.solana && window.solana.isPhantom;
      
      if (!isPhantomInstalled) {
        toast({
          title: "Phantom Wallet Required",
          description: "Please install Phantom wallet to continue",
          variant: "destructive"
        });
        setIsConnecting(false);
        return;
      }

      // Connect to Phantom wallet
      const response = await window.solana.connect();
      console.log('Connected to Phantom:', response.publicKey.toString());
      
      // Simulate payment process
      toast({
        title: "Payment Initiated",
        description: "Please confirm the transaction in your wallet",
      });

      // Simulate successful payment after 3 seconds
      setTimeout(() => {
        onSuccess({
          transactionId: 'mock_solana_tx_' + Date.now(),
          paymentMethod: 'solana',
          amount: solanaAmount,
          currency: 'SOL',
          walletAddress: response.publicKey.toString()
        });
      }, 3000);

    } catch (error) {
      console.error('Phantom wallet error:', error);
      onError('Failed to connect to Phantom wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const openPhantomWallet = () => {
    window.open('https://phantom.app/', '_blank');
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-purple-600" />
          Solana Pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-purple-600">
            {solanaAmount.toFixed(4)} SOL
          </div>
          <div className="text-sm text-gray-600">≈ £{amount.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{itemName}</div>
        </div>

        <Button onClick={onCancel} variant="outline" className="w-full mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payment Methods
        </Button>

        <div className="space-y-4">
          <div className="text-center">
            <img 
              src={qrCodeUrl} 
              alt="Solana Pay QR Code" 
              className="mx-auto mb-2 rounded-lg border"
            />
            <p className="text-xs text-gray-600">Scan with Solana wallet</p>
          </div>

          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 mb-1">Wallet Address:</p>
                <p className="text-sm font-mono truncate">{walletAddress}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(walletAddress)}
                className="ml-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={connectPhantomWallet}
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={isConnecting}
            >
              <Wallet className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect Phantom Wallet'}
            </Button>

            <Button
              onClick={openPhantomWallet}
              variant="outline"
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Get Phantom Wallet
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            <p>Fast • Secure • Low Fees</p>
            <p>Powered by Solana blockchain</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Extend Window interface for Solana
declare global {
  interface Window {
    solana?: {
      isPhantom: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
    };
  }
}

export default SolanaPayCheckout;
