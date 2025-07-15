
import React, { useState, useEffect } from 'react';
import { Download, Heart, Calendar, BarChart3, FileText, Quote, Receipt, Eye, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { userDocumentService } from '@/services/userDocumentService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/currencyUtils';
import AccountSettings from '@/components/AccountSettings';

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalDownloads: 0,
    totalSpent: 0,
    favoriteCount: 0,
    totalQuotes: 0,
    totalInvoices: 0
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const [purchasesData, favoritesData, quotesData, invoicesData] = await Promise.all([
        userDocumentService.getUserPurchases(),
        userDocumentService.getUserFavorites(),
        fetchQuotes(),
        fetchInvoices()
      ]);

      setPurchases(purchasesData || []);
      setFavorites(favoritesData || []);
      setQuotes(quotesData || []);
      setInvoices(invoicesData || []);

      // Calculate stats
      const totalPurchases = purchasesData?.length || 0;
      const totalDownloads = purchasesData?.reduce((sum, item) => sum + (item.download_count || 0), 0) || 0;
      const totalSpent = purchasesData?.reduce((sum, item) => sum + (item.documents?.price || 0), 0) || 0;
      const favoriteCount = favoritesData?.length || 0;
      const totalQuotes = quotesData?.length || 0;
      const totalInvoices = invoicesData?.length || 0;

      setStats({
        totalPurchases,
        totalDownloads,
        totalSpent,
        favoriteCount,
        totalQuotes,
        totalInvoices
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

  const fetchQuotes = async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
      return [];
    }
    return data;
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
    return data;
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

  const handleViewQuoteInvoice = (type) => {
    console.log('Navigating to business tools with type:', type);
    navigate('/business-tools', { 
      state: { selectedTool: 'business-finance-assistant' },
      replace: false 
    });
  };

  const handleDownloadQuoteInvoice = (document, type) => {
    try {
      const items = JSON.parse(document.items || '[]');
      const subtotal = document.subtotal || 0;
      const taxAmount = document.tax_amount || 0;
      const total = document.total_amount || 0;
      const currency = document.currency || 'USD';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${type === 'quote' ? 'Quote' : 'Invoice'} ${type === 'quote' ? document.quote_number : document.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; align-items: flex-start; }
            .company-info h1 { margin: 0; color: #2563eb; font-size: 28px; }
            .company-info p { margin: 5px 0; color: #666; }
            .document-title { text-align: right; }
            .document-title h2 { margin: 0; font-size: 2.5em; color: #374151; font-weight: bold; }
            .document-title p { margin: 5px 0; font-size: 14px; }
            .client-info { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .client-info h3 { margin: 0 0 15px 0; color: #374151; }
            .client-info p { margin: 3px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .items-table th { background-color: #f1f5f9; font-weight: 600; color: #374151; }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            .totals { margin: 30px 0; }
            .totals-table { margin-left: auto; min-width: 300px; }
            .totals-table td { padding: 8px 15px; border: none; }
            .totals-table .subtotal-row { border-bottom: 1px solid #ddd; }
            .totals-table .total-row { border-top: 2px solid #374151; font-weight: bold; font-size: 18px; }
            .notes { margin: 40px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .notes h3 { margin: 0 0 15px 0; color: #374151; }
            .logo { max-height: 80px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              ${document.logo_url ? `<img src="${document.logo_url}" alt="Logo" class="logo">` : ''}
              <h1>${document.company_name || 'Company Name'}</h1>
              <p>${(document.company_address || '').replace(/\n/g, '<br>')}</p>
            </div>
            <div class="document-title">
              <h2>${type === 'quote' ? 'QUOTE' : 'INVOICE'}</h2>
              <p><strong>Number:</strong> ${type === 'quote' ? document.quote_number : document.invoice_number}</p>
              <p><strong>Date:</strong> ${new Date(document.created_at).toLocaleDateString()}</p>
              ${type === 'quote' && document.valid_until ? `<p><strong>Valid Until:</strong> ${new Date(document.valid_until).toLocaleDateString()}</p>` : ''}
              ${type === 'invoice' && document.due_date ? `<p><strong>Due Date:</strong> ${new Date(document.due_date).toLocaleDateString()}</p>` : ''}
            </div>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <p><strong>${document.client_name}</strong></p>
            <p>${document.client_email}</p>
            <p>${(document.client_address || '').replace(/\n/g, '<br>')}</p>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(item.rate, currency)}</td>
                  <td class="text-right">${formatCurrency(item.amount, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <table class="totals-table">
              <tr class="subtotal-row">
                <td>Subtotal:</td>
                <td class="text-right">${formatCurrency(subtotal, currency)}</td>
              </tr>
              ${taxAmount > 0 ? `
              <tr class="subtotal-row">
                <td>Tax (${document.tax_rate}%):</td>
                <td class="text-right">${formatCurrency(taxAmount, currency)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td><strong>Total:</strong></td>
                <td class="text-right"><strong>${formatCurrency(total, currency)}</strong></td>
              </tr>
            </table>
          </div>
          
          ${document.notes ? `
          <div class="notes">
            <h3>Notes:</h3>
            <p>${document.notes.replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${type === 'quote' ? document.quote_number : document.invoice_number}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `${type === 'quote' ? 'Quote' : 'Invoice'} downloaded successfully.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Purchases</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPurchases}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Downloads</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDownloads}</div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewQuoteInvoice('quote')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes</CardTitle>
              <Quote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuotes}</div>
              <p className="text-xs text-muted-foreground">Click to manage</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewQuoteInvoice('invoice')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
              <p className="text-xs text-muted-foreground">Click to manage</p>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="purchases">My Purchases</TabsTrigger>
            <TabsTrigger value="favorites">My Favorites</TabsTrigger>
            <TabsTrigger value="settings">Account Settings</TabsTrigger>
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

          <TabsContent value="settings" className="space-y-4">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserDashboard;
