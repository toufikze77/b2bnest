
import SmartSearch from "@/components/SmartSearch";
import { Link } from "react-router-dom";

interface HeroSectionProps {
  onSearch: (query: string) => void;
}

const HeroSection = ({ onSearch }: HeroSectionProps) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Professional Business Document Templates for <span className="text-blue-600">Modern B2B Companies</span>
        </h1>
        <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
          Download 500+ premium business templates trusted by over 10,000 companies worldwide. 
          From legal contracts to marketing proposals - streamline your workflow and ensure compliance.
        </p>
        <div className="flex justify-center gap-4 mb-8">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
            ⚡ Instant Download
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
            ⚖️ Legal Compliance
          </div>
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-semibold">
            🎨 Professional Design
          </div>
        </div>
        
        {/* Smart Search Bar */}
        <div className="mb-8">
          <SmartSearch onSearch={onSearch} placeholder="Search business documents, forms, and tools..." unified={true} />
        </div>
        
        {/* Quick Links */}
        <div className="flex justify-center gap-6 mb-8">
          <a
            href="https://www.linkedin.com/company/aiplatform/about/?viewAsMember=true"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-blue-700 hover:to-blue-800"
          >
            <span className="flex items-center gap-2">
              💼 LinkedIn
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
          <a
            href="https://twitter.com/B2BNEST"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-gradient-to-r from-gray-800 to-black text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-black hover:to-gray-900"
          >
            <span className="flex items-center gap-2">
              X @B2BNEST
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
          <a
            href="https://www.pinksale.finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-pink-600 hover:to-purple-700"
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
