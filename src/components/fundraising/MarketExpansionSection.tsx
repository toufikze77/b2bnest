
import { Rocket } from 'lucide-react';

const MarketExpansionSection = () => {
  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <Rocket className="h-8 w-8 mr-3 text-orange-600" />
          Aggressive Market Expansion Strategy
        </h3>
        <p className="text-lg font-semibold text-orange-800">Complete Business Solution = Market Domination</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 text-lg">📈 Fund Allocation for Growth:</h4>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>• <strong>60% Development:</strong> Accelerate feature development</li>
            <li>• <strong>30% Marketing:</strong> Aggressive market penetration</li>
            <li>• <strong>10% Operations:</strong> Scale team and infrastructure</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 text-lg">🎯 Why We'll Dominate:</h4>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>• <strong>All-in-One Platform:</strong> Everything businesses need</li>
            <li>• <strong>Document Management + CRM + Operations</strong></li>
            <li>• <strong>AI-Powered Automation</strong> for efficiency</li>
            <li>• <strong>Cost-Effective</strong> compared to multiple tools</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 p-4 bg-white rounded-lg border border-orange-300">
        <h4 className="font-semibold text-orange-900 mb-3 text-center">🔥 Market Penetration Plan</h4>
        <p className="text-sm text-gray-700 text-center mb-3">
          <strong>B2BNest replaces 5-10 separate business tools</strong> - making it irresistible to cost-conscious businesses
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="text-center">
            <div className="font-semibold text-orange-800">Phase 1: Launch</div>
            <div className="text-gray-600">Target SMBs with cost savings</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-800">Phase 2: Scale</div>
            <div className="text-gray-600">Enterprise features & partnerships</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-800">Phase 3: Dominate</div>
            <div className="text-gray-600">Market leader in B2B solutions</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketExpansionSection;
