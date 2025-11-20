import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  Briefcase, 
  ShoppingCart, 
  Search, 
  MapPin,
  ArrowRight,
  Star,
  TrendingUp,
  CheckCircle,
  Globe,
  Target,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const BusinessDirectory = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    companies: 0,
    suppliers: 0,
    services: 0,
    totalListings: 0
  });
  const [featuredListings, setFeaturedListings] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchFeaturedListings();
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchQuery = query.toLowerCase().trim();
      
      // Search companies
      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,industry.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
        .limit(10);

      // Search suppliers  
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,contact_person.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
        .limit(10);

      // Search services
      const { data: services } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_service', true)
        .eq('is_active', true)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
        .limit(10);

      // Combine and format results
      const results = [
        ...(companies || []).map(item => ({ ...item, type: 'Company', searchType: 'companies' })),
        ...(suppliers || []).map(item => ({ ...item, type: 'Supplier', searchType: 'suppliers' })),
        ...(services || []).map(item => ({ ...item, type: 'Service', searchType: 'services' }))
      ];

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounced search after user stops typing
    if (value.length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch(value);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setShowSearchResults(false);
      setSearchResults([]);
    }
  };

  const navigateToResult = (result: any) => {
    switch (result.searchType) {
      case 'companies':
        navigate('/directory/companies');
        break;
      case 'suppliers':
        navigate('/directory/suppliers');
        break;
      case 'services':
        navigate('/directory/services');
        break;
    }
  };

  const fetchStats = async () => {
    try {
      const [companiesResult, suppliersResult, servicesResult] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact' }),
        supabase.from('suppliers').select('id', { count: 'exact' }),
        supabase.from('advertisements').select('id', { count: 'exact' }).eq('is_service', true).eq('is_active', true)
      ]);

      const companiesCount = companiesResult.count || 0;
      const suppliersCount = suppliersResult.count || 0;
      const servicesCount = servicesResult.count || 0;

      setStats({
        companies: companiesCount,
        suppliers: suppliersCount,
        services: servicesCount,
        totalListings: companiesCount + suppliersCount + servicesCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFeaturedListings = async () => {
    try {
      // Get featured services
      const { data: services } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_service', true)
        .eq('is_active', true)
        .not('featured_until', 'is', null)
        .gte('featured_until', new Date().toISOString())
        .limit(3);

      // Get recent companies
      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

      // Get recent suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      const combined = [
        ...(services || []).map(s => ({ ...s, type: 'Service', category: s.category, location: 'UK' })),
        ...(companies || []).map(c => ({ ...c, type: 'Company', category: c.industry, location: c.location })),
        ...(suppliers || []).map(s => ({ ...s, type: 'Supplier', category: 'Supply Chain', location: s.address }))
      ];

      setFeaturedListings(combined.slice(0, 6));
    } catch (error) {
      console.error('Error fetching featured listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const directoryCategories = [
    {
      id: 'companies',
      title: 'Company Directory',
      description: 'Connect with established businesses, explore partnerships, and discover industry leaders across all sectors',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      path: '/directory/companies',
      features: ['Verified company profiles', 'Industry classification', 'Contact information', 'Partnership opportunities'],
      benefits: 'Find trusted business partners and expand your network'
    },
    {
      id: 'suppliers',
      title: 'Supplier Network',
      description: 'Access a curated network of verified suppliers and vendors to streamline your supply chain operations',
      icon: ShoppingCart,
      color: 'from-green-500 to-emerald-500',
      path: '/directory/suppliers',
      features: ['Quality-verified suppliers', 'Transparent pricing', 'Global reach', 'Reliability ratings'],
      benefits: 'Reduce costs and improve supply chain efficiency'
    },
    {
      id: 'services',
      title: 'Professional Services',
      description: 'Discover expert consultants, agencies, and specialists to accelerate your business growth',
      icon: Briefcase,
      color: 'from-purple-500 to-pink-500',
      path: '/directory/services',
      features: ['Expert professionals', 'Competitive pricing', 'Portfolio showcase', 'Client testimonials'],
      benefits: 'Access specialized expertise on demand'
    },
  ];

  const successStories = [
    {
      company: "TechStart Solutions",
      story: "Found 3 key suppliers through our platform, reducing procurement costs by 25%",
      industry: "Technology",
      result: "25% cost reduction"
    },
    {
      company: "Green Energy Ltd",
      story: "Connected with 50+ potential clients, increasing revenue by 40% in 6 months",
      industry: "Renewable Energy",
      result: "40% revenue increase"
    },
    {
      company: "Digital Marketing Pro",
      story: "Expanded service offerings through strategic partnerships found on platform",
      industry: "Marketing",
      result: "3x service expansion"
    }
  ];

  const whyChooseUs = [
    {
      icon: CheckCircle,
      title: "Verified Businesses",
      description: "All listings undergo thorough verification to ensure legitimacy and quality"
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Connect with businesses worldwide while maintaining local presence"
    },
    {
      icon: Target,
      title: "Targeted Matching",
      description: "Advanced algorithms match you with the most relevant business opportunities"
    },
    {
      icon: Zap,
      title: "Fast Results",
      description: "Average connection time of 24 hours with immediate contact capabilities"
    }
  ];

  const DirectoryCard = ({ category }: { category: typeof directoryCategories[0] }) => {
    const IconComponent = category.icon;
    const categoryStats = stats[category.id as keyof typeof stats] || 0;
    
    return (
      <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer h-full">
        <CardHeader className="text-center pb-4">
          <div className={`mx-auto w-16 h-16 bg-gradient-to-r ${category.color} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            {category.title}
          </CardTitle>
          <div className="text-sm font-medium text-blue-600">
            {categoryStats > 0 ? `${categoryStats.toLocaleString()}+ ${category.title.split(' ')[0]}s` : 'Growing Network'}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-gray-600 text-center text-sm">{category.description}</p>
          
          <div className="space-y-2">
            {category.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">{category.benefits}</p>
          </div>
          
          <Button 
            className={`w-full mt-6 bg-gradient-to-r ${category.color} hover:opacity-90 text-white font-semibold group-hover:scale-105 transition-transform`}
            onClick={() => navigate(category.path)}
          >
            Explore {category.title}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <SEOHead 
        title="Business Directory Hub - Connect, Collaborate, Grow | B2B Platform"
        description="Discover verified suppliers, companies, and professional services. Join thousands of businesses in our comprehensive B2B directory. Find partners, streamline operations, and accelerate growth."
        keywords="business directory, B2B platform, suppliers, companies, professional services, business networking, procurement, partnerships"
        ogTitle="Leading B2B Business Directory - Connect with Verified Partners"
        ogDescription="Join the UK's premier business directory. Connect with 10,000+ verified suppliers, companies, and service providers. Streamline your business operations today."
        canonicalUrl="https://b2bnest.online/directory"
        schemaMarkup={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "B2B Nest Business Directory",
          "description": "Comprehensive business directory connecting suppliers, companies, and professional services",
          "url": "https://b2bnest.online",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://b2bnest.online/directory?search={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            UK's Premier Business Directory Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-8">
            Connect with verified suppliers, established companies, and expert professionals. 
            Join {stats.totalListings > 0 ? `${stats.totalListings.toLocaleString()}+` : 'thousands of'} businesses 
            already growing through strategic partnerships and streamlined procurement.
          </p>
          
          {/* Quick Search */}
          <div className="max-w-2xl mx-auto relative">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  placeholder="Search companies, services, or professionals..."
                  className="w-full pl-12 pr-20 py-4 rounded-xl border border-gray-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                <Button 
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-2 px-6 py-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </form>
            
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
                {searchResults.length > 0 ? (
                  <div className="p-4">
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      Found {searchResults.length} results
                    </div>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => navigateToResult(result)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex-shrink-0">
                          {result.type === 'Company' && <Building2 className="h-5 w-5 text-blue-600" />}
                          {result.type === 'Supplier' && <ShoppingCart className="h-5 w-5 text-green-600" />}
                          {result.type === 'Service' && <Briefcase className="h-5 w-5 text-purple-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 truncate">
                              {result.title || result.name}
                            </h4>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              {result.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {result.description || result.industry || result.category || 'No description available'}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-3">
                      <button
                        onClick={() => setShowSearchResults(false)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Close search results
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No results found for "{searchTerm}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Directory Categories */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Explore Our Business Ecosystem
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Choose your path to business growth. Each directory is carefully curated to provide maximum value and verified connections.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {directoryCategories.map((category) => (
              <DirectoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>

        {/* Why Choose Us Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Businesses Choose Our Platform
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyChooseUs.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Featured Listings */}
        {featuredListings.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Business Listings</h2>
              <p className="text-gray-600">Discover top-rated businesses and premium service providers</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map((listing, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-blue-600 font-medium">{listing.type}</div>
                        <CardTitle className="text-lg">{listing.title || listing.name}</CardTitle>
                        <div className="text-sm text-gray-600">{listing.category}</div>
                      </div>
                      {listing.view_count && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{listing.view_count}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {listing.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <MapPin className="h-4 w-4" />
                        <span>{listing.location}</span>
                      </div>
                    )}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {listing.description}
                    </p>
                    <Button variant="outline" className="w-full">
                      View Profile
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Success Stories */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Success Stories from Our Community
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {successStories.map((story, index) => (
              <Card key={index} className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="text-sm text-green-600 font-medium mb-2">{story.industry}</div>
                  <h3 className="font-semibold text-gray-900 mb-3">{story.company}</h3>
                  <p className="text-gray-600 text-sm mb-4 italic">"{story.story}"</p>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-green-700 font-semibold text-sm">Result: {story.result}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dynamic Stats Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Platform Growth & Impact
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {stats.totalListings > 0 ? `${stats.totalListings.toLocaleString()}+` : '10,000+'}
              </div>
              <div className="text-gray-600">Active Businesses</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">150+</div>
              <div className="text-gray-600">Industry Sectors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">25,000+</div>
              <div className="text-gray-600">Successful Connections</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">95%</div>
              <div className="text-gray-600">Customer Satisfaction</div>
            </div>
          </div>
        </div>

        {/* SEO-Optimized CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">Join the UK's Fastest Growing B2B Network</h2>
            <p className="text-xl mb-8 opacity-90">
              List your business today and connect with thousands of potential partners, suppliers, and clients. 
              Start growing your business network in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8"
                onClick={() => navigate('/auth')}
              >
                List Your Business Free
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-blue-600 font-semibold px-8"
                onClick={() => navigate('/contact')}
              >
                Schedule Demo
              </Button>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-8 pt-8 border-t border-white/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center opacity-90">
                <div>
                  <div className="text-lg font-semibold">24/7</div>
                  <div className="text-sm">Support Available</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">SSL</div>
                  <div className="text-sm">Secure Platform</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">GDPR</div>
                  <div className="text-sm">Compliant</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">FREE</div>
                  <div className="text-sm">Basic Listing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BusinessDirectory;