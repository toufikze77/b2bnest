import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Globe, Users, Calendar, Building2, Filter, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RegionSelector from '@/components/RegionSelector';

interface Company {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  founded_year: number | null;
  created_at: string;
  created_by: string | null;
}

const CompanyDirectory = () => {
  const { user } = useAuth();
  const { subscription_tier, subscribed } = useSubscription();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail',
    'Education', 'Real Estate', 'Consulting', 'Marketing', 'Legal'
  ];

  const companySizes = [
    '1-10 employees', '11-50 employees', '51-200 employees', 
    '201-500 employees', '500+ employees'
  ];

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    filterAndSortCompanies();
  }, [companies, searchTerm, sortBy, filterIndustry, filterSize]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Error",
        description: "Failed to load company directory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCompanies = () => {
    let filtered = companies;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by industry
    if (filterIndustry !== 'all') {
      filtered = filtered.filter(company => company.industry === filterIndustry);
    }

    // Filter by company size
    if (filterSize !== 'all') {
      filtered = filtered.filter(company => company.size === filterSize);
    }

    // Sort companies
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'founded':
          return (b.founded_year || 0) - (a.founded_year || 0);
        default:
          return 0;
      }
    });

    setFilteredCompanies(filtered);
  };

  const CompanyCard = ({ company }: { company: Company }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start gap-4">
          {company.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={`${company.name} logo`}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          )}
          <div className="flex-1">
            <CardTitle className="text-xl text-blue-600">{company.name}</CardTitle>
            {company.industry && (
              <Badge variant="secondary" className="mt-2">{company.industry}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {company.description && (
          <p className="text-gray-600 text-sm line-clamp-3">{company.description}</p>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {company.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{company.location}</span>
            </div>
          )}
          
          {company.size && (
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              <span>{company.size}</span>
            </div>
          )}
          
          {company.founded_year && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Founded {company.founded_year}</span>
            </div>
          )}
          
          {company.website && (
            <div className="flex items-center gap-2 text-gray-600">
              <Globe className="h-4 w-4" />
              <a 
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                Visit Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <span className="text-xs text-gray-500">
            Listed {new Date(company.created_at).toLocaleDateString()}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              View Profile
            </Button>
            <Button size="sm">
              Connect
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Company Directory</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover and connect with businesses across various industries
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search companies, industries, or locations..."
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
                <SelectItem value="name">Company Name</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="founded">Recently Founded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(industry => (
                  <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSize} onValueChange={setFilterSize}>
              <SelectTrigger>
                <SelectValue placeholder="Company Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {companySizes.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredCompanies.length} of {companies.length} companies
          </p>
        </div>

        {/* Companies Grid */}
        {filteredCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search criteria' : 'No companies are currently listed'}
            </p>
          </div>
        )}

        {/* Add Company CTA */}
        {user && (
          <div className="mt-12 text-center">
            <div className="bg-blue-50 rounded-lg p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                List Your Company
              </h3>
              <p className="text-gray-600 mb-6">
                Showcase your business and connect with potential partners, clients, and talent
              </p>
              {subscribed && subscription_tier !== 'free' ? (
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    window.location.href = '/auth';
                  }}
                >
                  Add Company Profile
                </Button>
              ) : (
                <div className="text-center">
                  <p className="text-orange-600 mb-4 font-medium">
                    Yearly subscription required to list your company
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      window.location.href = '/pricing';
                    }}
                  >
                    Upgrade to Yearly Plan
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CompanyDirectory;