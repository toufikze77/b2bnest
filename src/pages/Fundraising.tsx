import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Shield, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import CountdownTimer from '@/components/fundraising/CountdownTimer';
import TokenInformation from '@/components/fundraising/TokenInformation';
import PurchasePanel from '@/components/fundraising/PurchasePanel';
import VideoExplanation from '@/components/fundraising/VideoExplanation';
import PinkSalePresaleSection from '@/components/fundraising/PinkSalePresaleSection';
import TokenSEO from '@/components/TokenSEO';
import PinkSaleCTA from '@/components/PinkSaleCTA';

const Fundraising = () => {
  const navigate = useNavigate();
  
  // Mock presale data
  const presaleData = {
    tokenName: 'B2BN',
    tokenSymbol: 'B2BN',
    totalSupply: '10,000,000',
    presalePrice: '0.0001',
    currentRaised: '245.8',
    hardCap: '500',
    softCap: '100',
    minContribution: '0.1',
    maxContribution: '10',
    participants: 1247,
    progress: 49.16
  };

  return (
    <>
      <TokenSEO page="presale" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Back Home
              </Button>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Buy B2BNEST Token - Best New Crypto 2025 Presale
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Invest in B2BNEST - A promising blockchain project for cross-border business transactions with real utility
            </p>
          <div className="flex items-center justify-center space-x-2 mb-8">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Shield className="h-4 w-4 mr-1" />
              Audited by PinkFinance
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Presale
            </Badge>
          </div>
        </div>

        {/* Video Explanation Section */}
        <div className="mb-12">
          <VideoExplanation />
        </div>

        {/* PinkSale Presale Section */}
        <PinkSalePresaleSection />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Presale Information */}
          <div className="lg:col-span-2 space-y-6">
            <CountdownTimer />
            <TokenInformation 
              tokenName={presaleData.tokenName}
              tokenSymbol={presaleData.tokenSymbol}
              totalSupply={presaleData.totalSupply}
              presalePrice={presaleData.presalePrice}
            />
          </div>

          {/* Purchase Panel */}
          <div className="space-y-6">
            <PurchasePanel 
              presalePrice={presaleData.presalePrice}
              tokenSymbol={presaleData.tokenSymbol}
              minContribution={presaleData.minContribution}
              maxContribution={presaleData.maxContribution}
            />

            {/* PinkSale CTA */}
            <PinkSaleCTA />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Important Disclaimer</h3>
          <p className="text-sm text-yellow-700">
            Cryptocurrency investments are subject to high market risk. Please make your investments cautiously. 
            Our AI-Powered Business Automation Platform will not be responsible for your investment losses. The information provided is not investment advice.
            Always do your own research before investing.
          </p>
        </div>
      </main>

        <Footer />
      </div>
    </>
  );
};

export default Fundraising;
