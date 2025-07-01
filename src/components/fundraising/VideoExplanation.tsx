
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play } from 'lucide-react';
import VideoTutorialSection from './VideoTutorialSection';
import EarlyInvestorBenefits from './EarlyInvestorBenefits';
import CryptoPaymentSection from './CryptoPaymentSection';
import MarketExpansionSection from './MarketExpansionSection';
import CommunitySection from './CommunitySection';

const VideoExplanation = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-center justify-center">
          <Play className="h-6 w-6 mr-2 text-blue-600" />
          How to Invest & Early Investor Benefits
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <VideoTutorialSection />
          <EarlyInvestorBenefits />
        </div>

        <CryptoPaymentSection />
        <MarketExpansionSection />
        <CommunitySection />
      </CardContent>
    </Card>
  );
};

export default VideoExplanation;
