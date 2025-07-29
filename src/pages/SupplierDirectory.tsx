import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Globe, Phone, Mail, Star, Filter, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RegionSelector from '@/components/RegionSelector';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  payment_terms: string | null;
  is_active: boolean;
  created_at: string;
  user_id: string;
}

const SupplierDirectory = () => {
  const { user } = useAuth();
  const { subscription_tier, subscribed } = useSubscription();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterActive, setFilterActive] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterAndSortSuppliers();
  }, [suppliers, searchTerm, sortBy, filterActive, selectedRegion]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to load suppliers directory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortSuppliers = () => {
    let filtered = suppliers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by active status
    if (filterActive !== 'all') {
      filtered = filtered.filter(supplier => 
        filterActive === 'active' ? supplier.is_active : !supplier.is_active
      );
    }

    // Sort suppliers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    setFilteredSuppliers(filtered);
  };

  const SupplierCard = ({ supplier }: { supplier: Supplier }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl text-blue-600 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {supplier.name}
            </CardTitle>
            {supplier.contact_person && (
              <p className="text-gray-600 mt-1">Contact: {supplier.contact_person}</p>
            )}
          </div>
          <Badge variant={supplier.is_active ? "default" : "secondary"}>
            {supplier.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {supplier.address && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">{supplier.address}</span>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4">
          {supplier.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${supplier.email}`} className="text-sm hover:text-blue-600 transition-colors">
                {supplier.email}
              </a>
            </div>
          )}
          
          {supplier.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4" />
              <a href={`tel:${supplier.phone}`} className="text-sm hover:text-blue-600 transition-colors">
                {supplier.phone}
              </a>
            </div>
          )}
        </div>

        {supplier.website && (
          <div className="flex items-center gap-2 text-gray-600">
            <Globe className="h-4 w-4" />
            <a 
              href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Visit Website
            </a>
          </div>
        )}

        {supplier.payment_terms && (
          <div className="mt-3">
            <Badge variant="outline">Payment Terms: {supplier.payment_terms}</Badge>
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-500">
            Listed {new Date(supplier.created_at).toLocaleDateString()}
          </span>
          <Button variant="outline" size="sm">
            Contact Supplier
          </Button>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Supplier Directory</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with verified suppliers and business partners in our comprehensive directory
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search suppliers, contacts, or locations..."
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
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredSuppliers.length} of {suppliers.length} suppliers
          </p>
        </div>

        {/* Suppliers Grid */}
        {filteredSuppliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No suppliers found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search criteria' : 'No suppliers are currently listed'}
            </p>
          </div>
        )}

        {/* Add Supplier CTA */}
        <div className="mt-12 text-center">
          <div className="bg-blue-50 rounded-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              List Your Business as a Supplier
            </h3>
            <p className="text-gray-600 mb-6">
              Join our network of trusted suppliers and connect with potential business partners
            </p>
            {user && subscribed && subscription_tier !== 'free' ? (
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  toast({
                    title: "Feature Coming Soon",
                    description: "Supplier listing form will be available soon. Contact support for assistance.",
                  });
                }}
              >
                Add Your Supplier Listing
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-orange-600 mb-4 font-medium">
                  {!user ? 'Sign in and get a yearly subscription to list your business' : 'Yearly subscription required to list your business'}
                </p>
                <Button 
                  size="lg" 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    window.location.href = user ? '/pricing' : '/auth';
                  }}
                >
                  {user ? 'Upgrade to Yearly Plan' : 'Sign In to Get Started'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SupplierDirectory;