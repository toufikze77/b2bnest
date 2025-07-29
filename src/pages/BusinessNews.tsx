import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Newspaper, 
  ExternalLink, 
  Clock, 
  RefreshCw,
  TrendingUp,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  link: string;
  published_at: string | null;
  source: string;
  category: string | null;
  image_url: string | null;
  created_at: string;
}

const BusinessNewsPage = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      // Get total count
      const { count } = await supabase
        .from('news_articles')
        .select('*', { count: 'exact', head: true });

      // Get articles for display
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;

      setTotalCount(count || 0);
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      toast({
        title: "Error",
        description: "Failed to load news articles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshNews = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can refresh news feeds",
        variant: "destructive"
      });
      return;
    }

    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-news');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `News refreshed: ${data.newArticles} new articles added`,
      });

      // Refresh the displayed articles
      await fetchNews();
    } catch (error) {
      console.error('Error refreshing news:', error);
      toast({
        title: "Error",
        description: "Failed to refresh news feeds",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Recently';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const categorizeArticles = (articles: NewsArticle[]) => {
    const cnbcArticles = articles.filter(article => article.source === 'CNBC');
    const cryptoArticles = articles.filter(article => article.source === 'CoinDesk');
    
    return { cnbcArticles, cryptoArticles };
  };

  const { cnbcArticles, cryptoArticles } = categorizeArticles(articles);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Business News</h1>
            <p className="text-muted-foreground text-lg">
              Stay updated with the latest business and investment news
            </p>
          </div>
          
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Newspaper className="h-8 w-8" />
                Business News
              </h1>
              <p className="text-muted-foreground text-lg">
                Stay updated with the latest business and crypto news from CNBC and CoinDesk
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={refreshNews}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh News'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">
                Latest business news
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CNBC Articles</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cnbcArticles.length}</div>
              <p className="text-xs text-muted-foreground">
                Business news stories
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coin News</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cryptoArticles.length}</div>
              <p className="text-xs text-muted-foreground">
                Crypto insights
              </p>
            </CardContent>
          </Card>
        </div>

        {/* News Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CNBC Business News */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                CNBC Business News
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {cnbcArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No CNBC articles available</p>
                  </div>
                ) : (
                  cnbcArticles.map((article) => (
                    <div
                      key={article.id}
                      className="border-b border-border last:border-b-0 pb-4 last:pb-0"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-medium text-sm leading-5 hover:text-primary transition-colors line-clamp-2">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {article.title}
                            </a>
                          </h4>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                        
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {article.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {article.source}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(article.published_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Crypto News */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                CoinDesk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {cryptoArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No crypto articles available</p>
                  </div>
                ) : (
                  cryptoArticles.map((article) => (
                    <div
                      key={article.id}
                      className="border-b border-border last:border-b-0 pb-4 last:pb-0"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-medium text-sm leading-5 hover:text-primary transition-colors line-clamp-2">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {article.title}
                            </a>
                          </h4>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                        
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {article.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {article.source}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(article.published_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            News powered by CNBC & CoinDesk • Updated automatically • 
            Last refresh: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BusinessNewsPage;