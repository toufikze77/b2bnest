
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Star, TrendingUp, Zap, Users, Share2, Target } from 'lucide-react';

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
                  <p className="text-sm text-gray-600">First 1000 token holders earn 15% of platform revenue distributed quarterly</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="bg-purple-100 p-2 rounded-full">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Premium Features Access</h4>
                  <p className="text-sm text-gray-600">First 1000 token holders get lifetime access to AI-powered document analysis and premium templates</p>
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

        {/* Community Involvement Section */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Join Our Growth Journey</h3>
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Target className="h-6 w-6 text-green-600" />
              <span className="text-lg font-semibold text-green-800">Expected Growth: $10+ Million Revenue</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <Share2 className="h-5 w-5 mr-2 text-blue-600" />
                Help Us Spread the Word
              </h4>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Share B2BNest with your business network</li>
                <li>• Promote our platform on social media</li>
                <li>• Refer colleagues to our free trial</li>
                <li>• Join our community discussions</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Community Impact Rewards</h4>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Extra bonus tokens for referrals</li>
                <li>• Early access to new features</li>
                <li>• Priority customer support</li>
                <li>• Exclusive investor community access</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-4">
              By investing in B2BNest, you're not just buying tokens - you're becoming part of a revolutionary platform 
              that's transforming how businesses handle documents and operations.
            </p>
            <div className="space-y-2">
              <p className="font-semibold text-green-800">Start your free trial today and experience the platform firsthand!</p>
              <p className="text-xs text-gray-500">Your investment + community support = Accelerated growth to $10M+</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoExplanation;
