
import { Star, TrendingUp, Zap, Users } from 'lucide-react';

const EarlyInvestorBenefits = () => {
  return (
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
            <p className="text-sm text-gray-600">First 500 token holders share 20% of platform revenue distributed quarterly</p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="bg-purple-100 p-2 rounded-full">
            <Zap className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Premium Features Access</h4>
            <p className="text-sm text-gray-600">First 100 token holders get one year access to AI-powered document analysis and premium templates</p>
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
        <h4 className="font-semibold text-blue-900 mb-2">🚀 Limited Time Airdrop</h4>
        <p className="text-sm text-blue-800">First 500 investors receive an additional 10% token airdrop!</p>
      </div>
    </div>
  );
};

export default EarlyInvestorBenefits;
