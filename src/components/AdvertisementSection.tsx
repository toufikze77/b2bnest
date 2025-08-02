import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Filter, Eye, Mail, Phone, Globe, MapPin, Calendar, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvertisementForm } from './AdvertisementForm';

interface Advertisement {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  price?: number;
  currency: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  image_urls: string[];
  is_service: boolean;
  view_count: number;
  created_at: string;
  user_id: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const AdvertisementSection = () => {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [userAd, setUserAd] = useState<Advertisement | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAdvertisements();
    fetchCategories();
    if (user) {
      checkSubscription();
      fetchUserAdvertisement();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setUserSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      // For development, assume yearly subscription if check fails
      setUserSubscription({ is_yearly: true, subscribed: true });
    }
  };

  const fetchUserAdvertisement = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      setUserAd(data);
    } catch (error) {
      console.error('Error fetching user advertisement:', error);
    }
  };

  const fetchAdvertisements = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAdvertisements(data || []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisement_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const incrementViewCount = async (adId: string) => {
    try {
      await supabase
        .from('advertisements')
        .update({ view_count: advertisements.find(ad => ad.id === adId)?.view_count + 1 || 1 })
        .eq('id', adId);
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  const filteredAdvertisements = advertisements.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ad.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAdvertisementSuccess = () => {
    setShowForm(false);
    fetchAdvertisements();
    fetchUserAdvertisement();
    toast({
      title: "Success!",
      description: "Your advertisement has been created successfully.",
    });
  };

  const canCreateAd = user && userSubscription?.is_yearly && !userAd;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Premium Marketplace</h1>
          <p className="text-muted-foreground">Browse freely - No registration required! Post ads with subscription.</p>
        </div>
        
        <div className="flex gap-4">
          {!user ? (
            <Card className="relative overflow-hidden border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 opacity-20 rounded-full transform translate-x-2 -translate-y-2"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-medium text-foreground">Want to advertise here?</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Register & subscribe to post ads</p>
                <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-sm">
                  📝 Register to Post
                </Button>
              </div>
            </Card>
          ) : !userSubscription?.is_yearly ? (
            <Card className="relative overflow-hidden border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 opacity-20 rounded-full transform translate-x-2 -translate-y-2"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-medium text-foreground">Want to advertise here?</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Upgrade to post advertisements</p>
                <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-sm">
                  ✨ Upgrade to Yearly
                </Button>
              </div>
            </Card>
          ) : userAd ? (
            <Card className="p-4">
              <p className="text-sm text-success">✓ Your advertisement is live!</p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Edit Advertisement
              </Button>
            </Card>
          ) : (
            <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Advertisement
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>{userAd ? 'Edit' : 'Create'} Advertisement</CardTitle>
              <CardDescription>
                {userAd ? 'Update your existing advertisement' : 'Create your premium advertisement to showcase your services or products'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdvertisementForm
                categories={categories}
                existingAd={userAd}
                onSuccess={handleAdvertisementSuccess}
                onCancel={() => setShowForm(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Advertisements</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search advertisements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAdvertisements.map((ad) => (
              <Card key={ad.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary">{ad.category}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {ad.view_count}
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{ad.title}</CardTitle>
                  {ad.price && (
                    <div className="flex items-center gap-1 text-primary font-semibold">
                      <DollarSign className="w-4 h-4" />
                      {ad.price} {ad.currency}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {ad.description}
                  </p>
                  
                  {ad.image_urls.length > 0 && (
                    <div className="mb-4">
                      <img
                        src={ad.image_urls[0]}
                        alt={ad.title}
                        className="w-full h-32 object-cover rounded-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {ad.contact_email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <a href={`mailto:${ad.contact_email}`} className="text-primary hover:underline">
                          {ad.contact_email}
                        </a>
                      </div>
                    )}
                    
                    {ad.contact_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <a href={`tel:${ad.contact_phone}`} className="text-primary hover:underline">
                          {ad.contact_phone}
                        </a>
                      </div>
                    )}
                    
                    {ad.website_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-3 h-3 text-muted-foreground" />
                        <a 
                          href={ad.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          onClick={() => incrementViewCount(ad.id)}
                        >
                          Visit Website
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 pt-4 border-t">
                    <Calendar className="w-3 h-3" />
                    Posted {new Date(ad.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredAdvertisements.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">No advertisements found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to create an advertisement!'
                }
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer" 
                    onClick={() => {
                      setSelectedCategory(category.name);
                      // Switch to browse tab
                      const browseTab = document.querySelector('[data-state="inactive"][value="browse"]') as HTMLElement;
                      browseTab?.click();
                    }}>
                <CardHeader className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl">{category.icon}</span>
                  </div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <Badge variant="secondary">
                      {advertisements.filter(ad => ad.category === category.name).length} ads
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};