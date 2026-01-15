import React from 'react';
import { SearchProvider, useSearch } from "@/contexts/SearchContext";
import { templateService } from "@/services/templateService";
import HeroSection from "@/components/HeroSection";
import TokenSEO from "@/components/TokenSEO";
import AdvancedSEOSchema from "@/components/AdvancedSEOSchema";

import FeaturedTemplatesSection from "@/components/FeaturedTemplatesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import TestimonialsSection from "@/components/TestimonialsSection";
import SearchResults from "@/components/SearchResults";
import UnifiedSearchResults from "@/components/UnifiedSearchResults";
import ProvisionalServicesSlideshow from "@/components/ProvisionalServicesSlideshow";
import AIDocumentAssistant from "@/components/AIDocumentAssistant";
import AIInvestmentShowcase from "@/components/AIInvestmentShowcase";
import BusinessToolsSection from "@/components/BusinessToolsSection";
import PinkSaleCTA from "@/components/PinkSaleCTA";
import { Template } from "@/types/template";

const IndexContent = () => {
  const { searchQuery, searchResults, unifiedResults, performSearch, performUnifiedSearch } = useSearch();

  const popularTemplates = templateService.getFeaturedTemplates();

  const handleSearch = async (query: string) => {
    // Use unified search for better results
    await performUnifiedSearch(query);
  };

  const handleTemplateSelect = (template: Template) => {
    // Scroll to template or show template details
    console.log('Selected template:', template.title);
    // You can implement navigation to template details or preview here
  };

  // Show search results if there's a search query, otherwise show popular templates
  const showSearchResults = searchQuery.trim().length > 0;
  const showUnifiedResults = showSearchResults && unifiedResults.length > 0;
  const resultsToShow = showSearchResults ? searchResults : popularTemplates;

  return (
    <div className="min-h-screen bg-background">
      <TokenSEO page="home" />
      <AdvancedSEOSchema page="home" />
      <HeroSection onSearch={handleSearch} />

      {/* Unified Search Results - Show immediately below search bar */}
      {showUnifiedResults && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="max-w-7xl mx-auto">
            <UnifiedSearchResults 
              results={unifiedResults} 
              searchQuery={searchQuery}
            />
          </div>
        </section>
      )}
      
      {/* Fallback to template search results if no unified results */}
      {showSearchResults && !showUnifiedResults && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="max-w-7xl mx-auto">
            <SearchResults 
              results={resultsToShow} 
              searchQuery={searchQuery}
            />
          </div>
        </section>
      )}


      {/* AI Investment Showcase - Only show when not searching */}
      {!showSearchResults && <AIInvestmentShowcase />}

      {/* Provisional Services Slideshow - Only show when not searching */}
      {!showSearchResults && <ProvisionalServicesSlideshow />}

      {/* Business Tools Section - Only show when not searching */}
      {!showSearchResults && <BusinessToolsSection />}

      {/* Featured Templates - Only show when not searching */}
      {!showSearchResults && <FeaturedTemplatesSection templates={resultsToShow} />}

      {/* Testimonials Section - only show when not searching */}
      {!showSearchResults && <TestimonialsSection />}

      {/* PinkSale CTA - Only show when not searching */}
      {!showSearchResults && (
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <PinkSaleCTA variant="large" />
        </section>
      )}

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
