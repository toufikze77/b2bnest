
import React, { useState, useEffect } from 'react';
import { Download, Heart, Calendar, BarChart3, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { userDocumentService } from '@/services/userDocumentService';
import { toast } from '@/components/ui/use-toast';

const UserDashboard = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalDownloads: 0,
    totalSpent: 0,
    favoriteCount: 0
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const [purchasesData, favoritesData] = await Promise.all([
        userDocumentService.getUserPurchases(),
        userDocumentService.getUserFavorites()
      ]);

      setPurchases(purchasesData || []);
      setFavorites(favoritesData || []);

      // Calculate stats
      const totalPurchases = purchasesData?.length || 0;
      const totalDownloads = purchasesData?.reduce((sum, item) => sum + (item.download_count || 0), 0) || 0;
      const totalSpent = purchasesData?.reduce((sum, item) => sum + (item.documents?.price || 0), 0) || 0;
      const favoriteCount = favoritesData?.length || 0;

      setStats({
        totalPurchases,
        totalDownloads,
        totalSpent,
        favoriteCount
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your dashboard data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      await userDocumentService.updateDownloadCount(documentId);
      toast({
        title: "Download Started",
        description: "Your document download has started."
      });
      // Refresh data to update download counts
      fetchUserData();
    } catch (error) {
      console.error('Error updating download count:', error);
      toast({
        title: "Error",
        description: "Failed to process download.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFavorite = async (documentId: string) => {
    try {
      await userDocumentService.removeFromFavorites(documentId);
      toast({
        title: "Removed from Favorites",
        description: "Document removed from your favorites."
      });
      fetchUserData();
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: "Error",
        description: "Failed to remove from favorites.",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to view your dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-lg">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.email}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPurchases}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDownloads}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{stats.totalSpent.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favorites</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.favoriteCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchases">My Purchases</TabsTrigger>
            <TabsTrigger value="favorites">My Favorites</TabsTrigger>
          </TabsList>
          
          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Purchased Documents</CardTitle>
                <CardDescription>
                  Documents you've purchased and can download anytime
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>You haven't purchased any documents yet.</p>
                    <p className="text-sm">Browse our templates to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {purchases.map((purchase) => (
                      <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{purchase.documents?.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{purchase.documents?.category}</Badge>
                            {purchase.documents?.subcategory && (
                              <Badge variant="secondary" className="text-xs">
                                {purchase.documents?.subcategory}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {purchase.documents?.description}
                          </p>
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                            <span>Downloads: {purchase.download_count}</span>
                            <span>
                              Purchased: {new Date(purchase.purchased_at).toLocaleDateString()}
                            </span>
                          </div>
                          <Button 
                            className="w-full" 
                            size="sm"
                            onClick={() => handleDownload(purchase.document_id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Again
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="favorites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Favorite Documents</CardTitle>
                <CardDescription>
                  Documents you've marked as favorites for quick access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {favorites.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Heart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>You haven't added any favorites yet.</p>
                    <p className="text-sm">Click the heart icon on templates to save them here!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.map((favorite) => (
                      <Card key={favorite.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{favorite.documents?.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{favorite.documents?.category}</Badge>
                            {favorite.documents?.subcategory && (
                              <Badge variant="secondary" className="text-xs">
                                {favorite.documents?.subcategory}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {favorite.documents?.description}
                          </p>
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                            <span className="text-green-600 font-medium">
                              {favorite.documents?.price === 0 ? 'Free' : `£${favorite.documents?.price}`}
                            </span>
                            <span>
                              Added: {new Date(favorite.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              {favorite.documents?.price === 0 ? 'Download' : 'Buy Now'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleRemoveFavorite(favorite.document_id)}
                            >
                              <Heart className="h-4 w-4 fill-current text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserDashboard;
