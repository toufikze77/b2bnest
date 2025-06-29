import { useState } from "react";
import { FileText, Users, Calculator, Briefcase, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import TestimonialsSection from "@/components/TestimonialsSection";
import { SearchProvider, useSearch } from "@/contexts/SearchContext";
import SmartSearch from "@/components/SmartSearch";
import SearchResults from "@/components/SearchResults";
import { templateService } from "@/services/templateService";

const IndexContent = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { searchQuery, searchResults, performSearch } = useSearch();

  const handleSignOut = async () => {
    await signOut();
  };

  const categories = templateService.getCategories();
  const popularTemplates = templateService.getFeaturedTemplates();

  const handleSearch = (query: string) => {
    performSearch(query);
  };

  // Show search results if there's a search query, otherwise show popular templates
  const showSearchResults = searchQuery.trim().length > 0;
  const resultsToShow = showSearchResults ? searchResults : popularTemplates;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">BizDocHub</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    Welcome, {user.email}
                  </span>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={() => navigate('/auth')}>Sign In</Button>
                  <Button onClick={() => navigate('/auth')}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
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
            <SmartSearch onSearch={handleSearch} />
          </div>

          {/* Search Results - Show immediately below search bar */}
          {showSearchResults && (
            <div className="mb-16">
              <SearchResults 
                results={resultsToShow} 
                searchQuery={searchQuery}
              />
            </div>
          )}

          {/* Stats - Only show when not searching */}
          {!showSearchResults && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
                <div className="text-gray-600">Document Templates</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">50K+</div>
                <div className="text-gray-600">Downloads</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">4.8★</div>
                <div className="text-gray-600">Average Rating</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories and Popular Forms - Only show when not searching */}
      {!showSearchResults && (
        <>
          {/* Categories */}
          <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
            <div className="max-w-7xl mx-auto">
              <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
                Browse by Category
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((category) => {
                  const templateCount = templateService.getTemplatesByCategory(category.id).length;
                  return (
                    <Card key={category.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                      <CardHeader className="text-center pb-4">
                        <div className={`${category.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                          <FileText className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-xl">{category.name}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pt-0">
                        <Badge variant="secondary" className="text-sm">
                          {templateCount} templates
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Popular Forms */}
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
                Featured Templates
              </h3>
              <SearchResults 
                results={resultsToShow} 
                searchQuery=""
              />
            </div>
          </section>
        </>
      )}

      {/* Testimonials Section - only show when not searching */}
      {!showSearchResults && <TestimonialsSection />}

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-white mb-6">
            Ready to Streamline Your Business?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses using our professional document templates 
            to save time and ensure compliance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
              Browse All Forms
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3 text-white border-white hover:bg-white hover:text-blue-600">
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">BizDocHub</span>
              </div>
              <p className="text-gray-400">
                Professional business forms and documents for modern companies.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Categories</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Legal Documents</li>
                <li>HR Forms</li>
                <li>Financial Templates</li>
                <li>Operations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>FAQs</li>
                <li>Live Chat</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Blog</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 BizDocHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
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
