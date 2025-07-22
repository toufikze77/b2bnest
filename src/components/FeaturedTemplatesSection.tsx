
import SearchResults from "@/components/SearchResults";
import { Template } from "@/types/template";

interface FeaturedTemplatesSectionProps {
  templates: Template[];
}

const FeaturedTemplatesSection = ({ templates }: FeaturedTemplatesSectionProps) => {
  // Filter to only show Professional Web Development Services - Premium Package
  const filteredTemplates = templates.filter(template => 
    template.title === 'Professional Web Development Services - Premium Package'
  );

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Featured Services
        </h3>
        <SearchResults 
          results={filteredTemplates} 
          searchQuery=""
        />
      </div>
    </section>
  );
};

export default FeaturedTemplatesSection;
