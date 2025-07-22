import React from 'react';
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
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';

const BusinessDirectory = () => {
  const navigate = useNavigate();

  const directoryCategories = [
    {
      id: 'companies',
      title: 'Company Directory',
      description: 'Discover businesses across all industries and connect with potential partners',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      stats: '2,500+ Companies',
      path: '/directory/companies',
      features: ['Company profiles', 'Industry filtering', 'Contact information', 'Business networking']
    },
    {
      id: 'suppliers',
      title: 'Supplier Network',
      description: 'Find verified suppliers and vendors for your business needs',
      icon: ShoppingCart,
      color: 'from-green-500 to-emerald-500',
      stats: '850+ Suppliers',
      path: '/directory/suppliers',
      features: ['Verified suppliers', 'Payment terms', 'Location-based search', 'Quality ratings']
    },
    {
      id: 'services',
      title: 'Professional Services',
      description: 'Browse professional services from consultants, agencies, and specialists',
      icon: Briefcase,
      color: 'from-purple-500 to-pink-500',
      stats: '1,200+ Services',
      path: '/directory/services',
      features: ['Service categories', 'Price comparisons', 'Client reviews', 'Direct booking']
    },
    {
      id: 'professionals',
      title: 'Professional Network',
      description: 'Connect with industry professionals and build your business network',
      icon: Users,
      color: 'from-orange-500 to-red-500',
      stats: '5,000+ Professionals',
      path: '/business-social',
      features: ['Professional profiles', 'Industry connections', 'Business matching', 'Networking events']
    }
  ];

  const featuredListings = [
    {
      type: 'Company',
      name: 'TechSolutions Ltd',
      category: 'Technology',
      location: 'London, UK',
      rating: 4.8,
      description: 'Leading software development company specializing in enterprise solutions'
    },
    {
      type: 'Service',
      name: 'Digital Marketing Pro',
      category: 'Marketing',
      location: 'Manchester, UK',
      rating: 4.9,
      description: 'Full-service digital marketing agency with proven ROI strategies'
    },
    {
      type: 'Supplier',
      name: 'Global Office Supplies',
      category: 'Office Equipment',
      location: 'Birmingham, UK',
      rating: 4.7,
      description: 'Reliable supplier of office equipment and business supplies'
    }
  ];

  const DirectoryCard = ({ category }: { category: typeof directoryCategories[0] }) => {
    const IconComponent = category.icon;
    
    return (
      <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer h-full">
        <CardHeader className="text-center pb-4">
          <div className={`mx-auto w-16 h-16 bg-gradient-to-r ${category.color} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            {category.title}
          </CardTitle>
          <div className="text-sm font-medium text-blue-600">{category.stats}</div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-gray-600 text-center">{category.description}</p>
          
          <div className="space-y-2">
            {category.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          
          <Button 
            className={`w-full mt-6 bg-gradient-to-r ${category.color} hover:opacity-90 text-white font-semibold group-hover:scale-105 transition-transform`}
            onClick={() => navigate(category.path)}
          >
            Browse {category.title}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Business Directory Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Your gateway to discovering businesses, suppliers, services, and professionals. 
            Connect, collaborate, and grow your business network.
          </p>
          
          {/* Quick Search */}
          <div className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search companies, services, or professionals..."
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
              <Button className="absolute right-2 top-2 px-6 py-2 bg-blue-600 hover:bg-blue-700">
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Directory Categories */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Explore Business Directories
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {directoryCategories.map((category) => (
              <DirectoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>

        {/* Featured Listings */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Listings</h2>
            <p className="text-gray-600">Discover top-rated businesses and services</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredListings.map((listing, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-blue-600 font-medium">{listing.type}</div>
                      <CardTitle className="text-lg">{listing.name}</CardTitle>
                      <div className="text-sm text-gray-600">{listing.category}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{listing.rating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <MapPin className="h-4 w-4" />
                    <span>{listing.location}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{listing.description}</p>
                  <Button variant="outline" className="w-full">
                    View Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Platform Statistics
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">8,550+</div>
              <div className="text-gray-600">Total Listings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">150+</div>
              <div className="text-gray-600">Industries</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">25,000+</div>
              <div className="text-gray-600">Connections Made</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">95%</div>
              <div className="text-gray-600">Success Rate</div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Join Our Network?</h2>
            <p className="text-xl mb-8 opacity-90">
              List your business and connect with thousands of potential partners and clients
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8"
                onClick={() => navigate('/auth')}
              >
                Get Started Free
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-blue-600 font-semibold px-8"
                onClick={() => navigate('/contact')}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BusinessDirectory;