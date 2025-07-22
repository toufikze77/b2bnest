
import SearchResults from "@/components/SearchResults";
import { Template } from "@/types/template";

interface FeaturedTemplatesSectionProps {
  templates: Template[];
}

const FeaturedTemplatesSection = ({ templates }: FeaturedTemplatesSectionProps) => {
  // Filter to only show specific featured services
  const filteredTemplates = templates.filter(template => 
    template.title === 'Professional Web Development Services - Premium Package' ||
    template.title === 'Merchants Cryptocurrency Integration Service' ||
    template.title === 'Stripe Payment Integration Service' ||
    template.title === 'SumUp Merchant Integration Service' ||
    template.title === 'E-commerce Platform Integration Service' ||
    template.title === 'SEO & Analytics Optimization Service' ||
    template.title === 'Business Automation & Workflow Service' ||
    template.title === 'Cloud Infrastructure & Security Service' ||
    template.title === 'Customer Support System Integration' ||
    template.title === 'Digital Marketing Automation Service'
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
