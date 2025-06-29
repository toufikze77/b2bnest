
import SearchResults from "@/components/SearchResults";
import { Template } from "@/types/template";

interface FeaturedTemplatesSectionProps {
  templates: Template[];
}

const FeaturedTemplatesSection = ({ templates }: FeaturedTemplatesSectionProps) => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Featured Templates
        </h3>
        <SearchResults 
          results={templates} 
          searchQuery=""
        />
      </div>
    </section>
  );
};

export default FeaturedTemplatesSection;
