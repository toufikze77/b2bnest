
import { SearchProvider, useSearch } from "@/contexts/SearchContext";
import { templateService } from "@/services/templateService";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import CategoriesSection from "@/components/CategoriesSection";
import FeaturedTemplatesSection from "@/components/FeaturedTemplatesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import TestimonialsSection from "@/components/TestimonialsSection";
import SearchResults from "@/components/SearchResults";
import ProvisionalServicesSlideshow from "@/components/ProvisionalServicesSlideshow";
import AIDocumentAssistant from "@/components/AIDocumentAssistant";
import { Template } from "@/types/template";

const IndexContent = () => {
  const { searchQuery, searchResults, performSearch } = useSearch();

  const popularTemplates = templateService.getFeaturedTemplates();

  const handleSearch = (query: string) => {
    performSearch(query);
  };

  const handleTemplateSelect = (template: Template) => {
    // Scroll to template or show template details
    console.log('Selected template:', template.title);
    // You can implement navigation to template details or preview here
  };

  // Show search results if there's a search query, otherwise show popular templates
  const showSearchResults = searchQuery.trim().length > 0;
  const resultsToShow = showSearchResults ? searchResults : popularTemplates;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />
      
      <HeroSection onSearch={handleSearch} />

      {/* Search Results - Show immediately below search bar */}
      {showSearchResults && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="max-w-7xl mx-auto">
            <SearchResults 
              results={resultsToShow} 
              searchQuery={searchQuery}
            />
          </div>
        </section>
      )}

      {/* Stats - Only show when not searching */}
      {!showSearchResults && (
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <StatsSection />
          </div>
        </section>
      )}

      {/* Provisional Services Slideshow - Only show when not searching */}
      {!showSearchResults && <ProvisionalServicesSlideshow />}

      {/* Categories and Popular Forms - Only show when not searching */}
      {!showSearchResults && (
        <>
          <CategoriesSection />
          <FeaturedTemplatesSection templates={resultsToShow} />
        </>
      )}

      {/* Testimonials Section - only show when not searching */}
      {!showSearchResults && <TestimonialsSection />}

      <CTASection />
      <Footer />

      {/* AI Document Assistant - Always visible */}
      <AIDocumentAssistant onTemplateSelect={handleTemplateSelect} />
    </div>
  );
};

const Index = () => {
  return (
    <SearchProvider>
      <IndexContent />
    </SearchProvider>
  );
};

export default Index;
