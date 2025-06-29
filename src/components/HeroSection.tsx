
import SmartSearch from "@/components/SmartSearch";

interface HeroSectionProps {
  onSearch: (query: string) => void;
}

const HeroSection = ({ onSearch }: HeroSectionProps) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Professional Business <span className="text-blue-600">Forms & Documents</span>
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          Access hundreds of professionally crafted business forms, contracts, and documents. 
          Save time and ensure compliance with our comprehensive template library.
        </p>
        
        {/* Smart Search Bar */}
        <div className="mb-8">
          <SmartSearch onSearch={onSearch} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
