
const StatsSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-blue-500">
        <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
        <div className="text-gray-600 font-medium">Professional Templates</div>
        <div className="text-sm text-green-600 mt-1">Constantly Updated</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-green-500">
        <div className="text-4xl font-bold text-green-600 mb-2">10,000+</div>
        <div className="text-gray-600 font-medium">Happy Customers</div>
        <div className="text-sm text-green-600 mt-1">Worldwide Trust</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-purple-500">
        <div className="text-4xl font-bold text-purple-600 mb-2">50+</div>
        <div className="text-gray-600 font-medium">Industries Served</div>
        <div className="text-sm text-purple-600 mt-1">Specialized Solutions</div>
      </div>
      <div className="text-center p-6 bg-white rounded-lg shadow-lg border-l-4 border-orange-500">
        <div className="text-4xl font-bold text-orange-600 mb-2">99%</div>
        <div className="text-gray-600 font-medium">Customer Satisfaction</div>
        <div className="text-sm text-orange-600 mt-1">Proven Quality</div>
      </div>
    </div>
  );
};

export default StatsSection;
