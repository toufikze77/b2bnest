
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
          Early-stage AI startup transforming business operations with intelligent document generation and automated workflows. 
          Serving 8,200+ businesses with proven traction and clear path to profitability.
        </p>
        <div className="flex justify-center gap-4 mb-8">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
            🚀 180% YoY Growth
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
            💡 AI-First Platform
          </div>
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-semibold">
            📈 Series A Ready
          </div>
        </div>
        
        {/* Quick Links */}
        <div className="flex justify-center gap-4 mb-8">
          <a
            href="https://twitter.com/b2bnest"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold hover:bg-blue-200 transition-colors"
          >
            🐦 Follow @b2bnest
          </a>
          <a
            href="https://www.pinksale.finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-pink-100 text-pink-800 px-4 py-2 rounded-full font-semibold hover:bg-pink-200 transition-colors"
          >
            💎 Pinksale Launch
          </a>
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
