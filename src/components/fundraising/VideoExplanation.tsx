
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Star, TrendingUp, Zap, Users } from 'lucide-react';

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
  );
};

export default VideoExplanation;
