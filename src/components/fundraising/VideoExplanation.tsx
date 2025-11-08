
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play } from 'lucide-react';
import VideoTutorialSection from './VideoTutorialSection';

const VideoExplanation = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-center justify-center">
          <Play className="h-6 w-6 mr-2 text-blue-600" />
          How to Invest
        </CardTitle>
      </CardHeader>
      <CardContent>
        <VideoTutorialSection />
      </CardContent>
    </Card>
  );
};

export default VideoExplanation;
