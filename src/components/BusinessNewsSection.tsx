import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Newspaper, 
  ExternalLink, 
  Clock, 
  RefreshCw,
  TrendingUp
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

const BusinessNewsSection = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Business News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Business News
          </CardTitle>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshNews}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Updating...' : 'Refresh'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No news articles available</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={refreshNews}
                  className="mt-4"
                  disabled={refreshing}
                >
                  Load News Articles
                </Button>
              )}
            </div>
          ) : (
            articles.map((article) => (
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {article.source}
                      </Badge>
                      {article.category && (
                        <Badge variant="outline" className="text-xs">
                          {article.category}
                        </Badge>
                      )}
                    </div>
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
        
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            News powered by CNBC & Investopedia • Auto-updates every hour
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessNewsSection;