import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, DollarSign, Star, Filter, Briefcase, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RegionSelector from '@/components/RegionSelector';

interface Advertisement {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  price: number | null;
  currency: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  image_urls: string[] | null;
  is_service: boolean;
  is_active: boolean;
  featured_until: string | null;
  view_count: number | null;
  created_at: string;
  user_id: string;
}

const ServiceDirectory = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Advertisement[]>([]);
  const [filteredServices, setFilteredServices] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  const categories = [
    'Consulting', 'Marketing', 'Web Development', 'Graphic Design', 'Legal Services',
    'Accounting', 'Business Services', 'IT Support', 'Training', 'Photography'
  ];

  const priceRanges = [
    { label: 'Under £100', value: '0-100' },
    { label: '£100 - £500', value: '100-500' },
    { label: '£500 - £1000', value: '500-1000' },
    { label: '£1000 - £5000', value: '1000-5000' },
    { label: '£5000+', value: '5000+' }
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterAndSortServices();
  }, [services, searchTerm, sortBy, filterCategory, priceRange]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_service', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "Failed to load service directory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortServices = () => {
    let filtered = services;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(service => service.category === filterCategory);
    }

    // Filter by price range
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(p => p === '+' ? Infinity : parseInt(p));
      filtered = filtered.filter(service => {
        if (!service.price) return false;
        return service.price >= min && (max === Infinity || service.price <= max);
      });
    }

    // Sort services
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price-low':
          return (a.price || 0) - (b.price || 0);
        case 'price-high':
          return (b.price || 0) - (a.price || 0);
        case 'popular':
          return (b.view_count || 0) - (a.view_count || 0);
        default:
          return 0;
      }
    });

    setFilteredServices(filtered);
  };

  const incrementViewCount = async (serviceId: string) => {
    try {
      // Get current view count and increment it
      const { data: currentData } = await supabase
        .from('advertisements')
        .select('view_count')
        .eq('id', serviceId)
        .single();

      const newCount = (currentData?.view_count || 0) + 1;
      
      await supabase
        .from('advertisements')
        .update({ view_count: newCount })
        .eq('id', serviceId);
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  const ServiceCard = ({ service }: { service: Advertisement }) => {
    const isFeatured = service.featured_until && new Date(service.featured_until) > new Date();
    
    return (
      <Card className={`hover:shadow-lg transition-shadow ${isFeatured ? 'ring-2 ring-yellow-400' : ''}`}>
        {isFeatured && (
          <div className="bg-yellow-400 text-black text-center py-1 text-xs font-semibold">
            FEATURED SERVICE
          </div>
        )}
        
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl text-blue-600 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {service.title}
              </CardTitle>
              <Badge variant="secondary" className="mt-2">{service.category}</Badge>
              {service.subcategory && (
                <Badge variant="outline" className="mt-2 ml-2">{service.subcategory}</Badge>
              )}
            </div>
            {service.price && (
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {service.currency || '£'}{service.price}
                </div>
                <div className="text-xs text-gray-500">starting from</div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {service.image_urls && service.image_urls.length > 0 && (
            <div className="aspect-video rounded-lg overflow-hidden">
              <img 
                src={service.image_urls[0]} 
                alt={service.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <p className="text-gray-600 text-sm line-clamp-3">{service.description}</p>
          
          <div className="flex flex-wrap gap-4 text-sm">
            {service.contact_email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${service.contact_email}`} className="hover:text-blue-600 transition-colors">
                  Email
                </a>
              </div>
            )}
            
            {service.contact_phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                <a href={`tel:${service.contact_phone}`} className="hover:text-blue-600 transition-colors">
                  Call
                </a>
              </div>
            )}
            
            {service.view_count && (
              <div className="flex items-center gap-2 text-gray-500">
                <Star className="h-4 w-4" />
                <span>{service.view_count} views</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-xs text-gray-500">
              Posted {new Date(service.created_at).toLocaleDateString()}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => incrementViewCount(service.id)}
              >
                View Details
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  if (service.contact_email) {
                    window.location.href = `mailto:${service.contact_email}?subject=Inquiry about ${service.title}`;
                  }
                }}
              >
                Contact
              </Button>
            </div>
          </div>
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Service Directory</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find professional services and solutions for your business needs
          </p>
        </div>

        {/* Region Selector */}
        <div className="mb-6">
          <RegionSelector 
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            showPopulator={true}
          />
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger>
                <SelectValue placeholder="Price Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                {priceRanges.map(range => (
                  <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredServices.length} of {services.length} services
          </p>
        </div>

        {/* Services Grid */}
        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search criteria' : 'No services are currently listed'}
            </p>
          </div>
        )}

        {/* Add Service CTA */}
        {user && (
          <div className="mt-12 text-center">
            <div className="bg-blue-50 rounded-lg p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                List Your Service
              </h3>
              <p className="text-gray-600 mb-6">
                Showcase your expertise and connect with clients looking for your services
              </p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Add Service Listing
              </Button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default ServiceDirectory;