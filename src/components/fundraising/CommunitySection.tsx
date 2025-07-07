
import { Share2, Target } from 'lucide-react';

const CommunitySection = () => {
  return (
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
            <li>• Share our AI Platform with your business network</li>
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
          By investing in our AI-Powered Business Automation Platform, you're not just buying tokens - you're becoming part of a revolutionary platform 
          that's transforming how businesses handle documents and operations.
        </p>
        <div className="space-y-2">
          <p className="font-semibold text-green-800">Start your free trial today and experience the platform firsthand!</p>
          <p className="text-xs text-gray-500">Your investment + community support = Accelerated growth to $10M+</p>
        </div>
      </div>
    </div>
  );
};

export default CommunitySection;
