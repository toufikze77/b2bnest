
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

const VideoTutorialSection = () => {
  return (
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
  );
};

export default VideoTutorialSection;
