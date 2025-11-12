import React, { useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import PinkSaleCTA from '@/components/PinkSaleCTA';

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const { isAdmin } = useUserRole();

  // Auto-refresh timer
  useEffect(() => {
    fetchNews();
    
    // Set up auto-refresh every 5 minutes
    const autoRefreshInterval = setInterval(() => {
      fetchNews();
    }, 5 * 60 * 1000);

    return () => clearInterval(autoRefreshInterval);
  }, []);

  // Slideshow auto-play
  useEffect(() => {
    if (!autoPlay || articles.length === 0) return;
    
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % Math.min(articles.length, 6));
    }, 4000);

    return () => clearInterval(slideInterval);
  }, [autoPlay, articles.length]);

  const fetchNews = async () => {
    try {
      // Get total count for CNBC and CoinDesk only
      const { count } = await supabase
        .from('news_articles')
        .select('*', { count: 'exact', head: true })
        .in('source', ['CNBC', 'CoinDesk']);

      // Get articles for display
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .in('source', ['CNBC', 'CoinDesk'])
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

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % Math.min(articles.length, 6));
  }, [articles.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + Math.min(articles.length, 6)) % Math.min(articles.length, 6));
  }, [articles.length]);

  const toggleAutoPlay = () => {
    setAutoPlay(!autoPlay);
  };

  const featuredArticles = articles.slice(0, 6);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-card/50 backdrop-blur-sm border rounded-3xl p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-primary to-primary/70 rounded-2xl shadow-lg">
                    <Newspaper className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Business News
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-muted-foreground">Live Updates</span>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Stay ahead of the market with real-time business insights and crypto developments from trusted sources
                </p>
              </div>
              {isAdmin && (
                <Button
                  onClick={refreshNews}
                  disabled={refreshing}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh News'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Newspaper className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {totalCount}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                Live business updates
              </p>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CNBC Business</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {cnbcArticles.length}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                Market insights
              </p>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coin News</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <DollarSign className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {cryptoArticles.length}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></div>
                Crypto developments
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Featured News Slideshow */}
        {featuredArticles.length > 0 && (
          <Card className="mb-8 relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
            <CardHeader className="relative border-b bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-primary/70 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">Featured News</div>
                    <div className="text-xs text-muted-foreground font-normal">Breaking Business Updates</div>
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAutoPlay}
                    className="h-8 w-8 p-0"
                  >
                    {autoPlay ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prevSlide}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={nextSlide}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-0">
              <div className="relative h-48 overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-in-out h-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {featuredArticles.map((article, index) => (
                    <div key={article.id} className="min-w-full h-full flex-shrink-0">
                      <div className="relative h-full bg-gradient-to-br from-background/50 to-muted/30 backdrop-blur-sm">
                        {article.image_url && (
                          <div className="absolute inset-0 opacity-20">
                            <img 
                              src={article.image_url} 
                              alt={article.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="relative p-6 h-full flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={article.source === 'CNBC' ? 'default' : 'secondary'}
                                className={article.source === 'CNBC' 
                                  ? 'bg-blue-500/20 text-blue-700 border-blue-200' 
                                  : 'bg-amber-500/20 text-amber-700 border-amber-200'
                                }
                              >
                                {article.source}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDate(article.published_at)}
                              </div>
                            </div>
                            <h3 className="text-xl font-bold line-clamp-2 leading-tight">
                              {article.title}
                            </h3>
                            {article.description && (
                              <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                {article.description}
                              </p>
                            )}
                          </div>
                          <div className="pt-4">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
                            >
                              Read full article
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Slide indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {featuredArticles.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentSlide 
                        ? 'bg-primary scale-125' 
                        : 'bg-primary/30 hover:bg-primary/50'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* News Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CNBC Business News */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
            <CardHeader className="relative border-b bg-gradient-to-r from-blue-500/10 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-lg font-bold">CNBC Business News</div>
                  <div className="text-xs text-muted-foreground font-normal">Market Analysis & Insights</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative p-0">
              <div className="space-y-0 max-h-[600px] overflow-y-auto">
                {cnbcArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No CNBC articles available</p>
                  </div>
                ) : (
                  cnbcArticles.map((article, index) => (
                    <div
                      key={article.id}
                      className="group border-b border-border/50 last:border-b-0 hover:bg-blue-500/5 transition-all duration-300"
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-medium text-sm leading-5 group-hover:text-blue-600 transition-colors line-clamp-2">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {article.title}
                            </a>
                          </h4>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
                        </div>
                        
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {article.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
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
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
            <CardHeader className="relative border-b bg-gradient-to-r from-amber-500/10 to-transparent">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-lg font-bold">CoinDesk</div>
                  <div className="text-xs text-muted-foreground font-normal">Crypto & Blockchain News</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative p-0">
              <div className="space-y-0 max-h-[600px] overflow-y-auto">
                {cryptoArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No crypto articles available</p>
                  </div>
                ) : (
                  cryptoArticles.map((article, index) => (
                    <div
                      key={article.id}
                      className="group border-b border-border/50 last:border-b-0 hover:bg-amber-500/5 transition-all duration-300"
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-medium text-sm leading-5 group-hover:text-amber-600 transition-colors line-clamp-2">
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {article.title}
                            </a>
                          </h4>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 flex-shrink-0 mt-0.5 transition-colors" />
                        </div>
                        
                        {article.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {article.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
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
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live Updates</span>
              </div>
              <span>•</span>
              <span>Powered by CNBC & CoinDesk</span>
              <span>•</span>
              <span>Auto-refreshed every 5 minutes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last update: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {/* PinkSale CTA */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <PinkSaleCTA variant="large" />
        </div>
      </div>
    </div>
  );
};

export default BusinessNewsPage;