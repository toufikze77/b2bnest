
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play } from 'lucide-react';
import HowToInvestSection from './HowToInvestSection';
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
        <HowToInvestSection />
        <CryptoPaymentSection />
        <MarketExpansionSection />
        <CommunitySection />
      </CardContent>
    </Card>
  );
};

export default VideoExplanation;
