
import SmartSearch from "@/components/SmartSearch";

interface HeroSectionProps {
  onSearch: (query: string) => void;
}

const HeroSection = ({ onSearch }: HeroSectionProps) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          AI-Powered Business <span className="text-blue-600">Automation Platform</span>
        </h2>
        <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
          Revolutionizing business operations with intelligent document generation, automated workflows, and AI-driven insights. 
          Serving 50,000+ businesses with 95% time reduction and $2M+ cost savings annually.
        </p>
        <div className="flex justify-center gap-4 mb-8">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
            🚀 300% YoY Growth
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
            💡 AI-First Platform
          </div>
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-semibold">
            📈 $50M TAM
          </div>
        </div>
        
        {/* Smart Search Bar */}
        <div className="mb-8">
          <SmartSearch onSearch={onSearch} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
