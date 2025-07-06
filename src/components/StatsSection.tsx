
const StatsSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-blue-500">
        <div className="text-4xl font-bold text-blue-600 mb-2">$420K</div>
        <div className="text-gray-600 font-medium">ARR Run Rate</div>
        <div className="text-sm text-green-600 mt-1">↗ 180% YoY</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-green-500">
        <div className="text-4xl font-bold text-green-600 mb-2">8.2K</div>
        <div className="text-gray-600 font-medium">Active Users</div>
        <div className="text-sm text-green-600 mt-1">↗ 78% retention</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-purple-500">
        <div className="text-4xl font-bold text-purple-600 mb-2">4.2x</div>
        <div className="text-gray-600 font-medium">LTV:CAC Ratio</div>
        <div className="text-sm text-purple-600 mt-1">Strong Unit Economics</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-orange-500">
        <div className="text-4xl font-bold text-orange-600 mb-2">$8M</div>
        <div className="text-gray-600 font-medium">Pre-Money Valuation</div>
        <div className="text-sm text-orange-600 mt-1">Series A Ready</div>
      </div>
    </div>
  );
};

export default StatsSection;
