
import SmartSearch from "@/components/SmartSearch";
import { Link } from "react-router-dom";

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
        
        {/* Smart Search Bar */}
        <div className="mb-8">
          <SmartSearch onSearch={onSearch} />
        </div>
        
        {/* Quick Links */}
        <div className="flex justify-center gap-6 mb-8">
          <Link
            to="/business-tools"
            className="group relative bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-teal-600 hover:to-teal-700"
          >
            <span className="flex items-center gap-2">
              🛠️ Business Tools
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Link>
          <a
            href="https://twitter.com/b2bnest"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-blue-600 hover:to-blue-700"
          >
            <span className="flex items-center gap-2">
              🐦 Follow @b2bnest
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
          <a
            href="https://www.pinksale.finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-pink-600 hover:to-purple-700"
          >
            <span className="flex items-center gap-2">
              💎 Pinksale Launch
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
