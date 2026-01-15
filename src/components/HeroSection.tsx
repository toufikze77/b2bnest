
import SmartSearch from "@/components/SmartSearch";
import { Link } from "react-router-dom";

interface HeroSectionProps {
  onSearch: (query: string) => void;
}

const HeroSection = ({ onSearch }: HeroSectionProps) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-foreground mb-6">
          Your Complete AI-Powered Business <span className="text-primary">Tools Hub</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
          Everything your business needs in one intelligent platform. From AI-powered document generation to smart financial tracking - streamline your entire workflow with cutting-edge tools designed for modern entrepreneurs.
        </p>
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold">
            🤖 AI-Powered
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold">
            ⚡ All-in-One Solution
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold">
            🎨 Professional Design
          </div>
        </div>
        
        {/* Smart Search Bar */}
        <div className="mb-8">
          <SmartSearch onSearch={onSearch} placeholder="Search business documents, forms, and tools..." unified={true} />
        </div>
        
        {/* Quick Links */}
        <div className="flex justify-center gap-6 mb-8 flex-wrap">
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
            className="group relative bg-gradient-to-r from-gray-800 to-black dark:from-gray-700 dark:to-gray-900 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:from-black hover:to-gray-900"
          >
            <span className="flex items-center gap-2">
              X @B2BNEST
            </span>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
          <a
            href="https://www.pinksale.finance/launchpad/ethereum/0xa3e47ea8bA047a848FF33Fa2292729327255b7B8"
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
        
        {/* Legal Links for Google Verification */}
        <div className="mt-8 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Legal & Compliance</p>
          <div className="flex justify-center gap-6 text-sm">
            <Link 
              to="/privacy" 
              className="text-primary hover:text-primary/80 font-medium hover:underline"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/terms" 
              className="text-primary hover:text-primary/80 font-medium hover:underline"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
