
const StatsSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
      <div className="text-center">
        <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
        <div className="text-gray-600">Document Templates</div>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold text-green-600 mb-2">50K+</div>
        <div className="text-gray-600">Downloads</div>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold text-purple-600 mb-2">4.8★</div>
        <div className="text-gray-600">Average Rating</div>
      </div>
    </div>
  );
};

export default StatsSection;
