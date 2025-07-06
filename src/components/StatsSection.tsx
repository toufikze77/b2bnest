
const StatsSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-blue-500">
        <div className="text-4xl font-bold text-blue-600 mb-2">$2.5M</div>
        <div className="text-gray-600 font-medium">ARR Growth</div>
        <div className="text-sm text-green-600 mt-1">↗ 300% YoY</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-green-500">
        <div className="text-4xl font-bold text-green-600 mb-2">50K+</div>
        <div className="text-gray-600 font-medium">Active Users</div>
        <div className="text-sm text-green-600 mt-1">↗ 85% retention</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-purple-500">
        <div className="text-4xl font-bold text-purple-600 mb-2">95%</div>
        <div className="text-gray-600 font-medium">Time Saved</div>
        <div className="text-sm text-purple-600 mt-1">AI Automation</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-orange-500">
        <div className="text-4xl font-bold text-orange-600 mb-2">$50M</div>
        <div className="text-gray-600 font-medium">TAM</div>
        <div className="text-sm text-orange-600 mt-1">Market Opportunity</div>
      </div>
    </div>
  );
};

export default StatsSection;
