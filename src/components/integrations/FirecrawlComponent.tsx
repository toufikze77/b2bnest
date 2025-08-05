import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Globe, Download, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CrawlResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ScrapeData {
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    url?: string;
  };
}

export const FirecrawlComponent = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [activeTab, setActiveTab] = useState('scrape');
  
  // Crawl options
  const [crawlLimit, setCrawlLimit] = useState(10);
  const [onlyMainContent, setOnlyMainContent] = useState(true);
  const [includeTags, setIncludeTags] = useState('');
  const [excludeTags, setExcludeTags] = useState('');

  const handleScrape = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      console.log('Starting scrape for URL:', url);
      
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: {
          url,
          action: 'scrape',
          options: {
            formats: ['markdown', 'html'],
            onlyMainContent,
            includeTags: includeTags ? includeTags.split(',').map(tag => tag.trim()) : undefined,
            excludeTags: excludeTags ? excludeTags.split(',').map(tag => tag.trim()) : undefined,
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setResult(data);
        toast({
          title: "Success",
          description: "Website scraped successfully",
        });
      } else {
        throw new Error(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      setResult({ success: false, error: error.message || 'Failed to scrape website' });
      toast({
        title: "Error",
        description: error.message || "Failed to scrape website",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCrawl = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      console.log('Starting crawl for URL:', url);
      
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: {
          url,
          action: 'crawl',
          options: {
            limit: crawlLimit,
            formats: ['markdown'],
            onlyMainContent,
            includeTags: includeTags ? includeTags.split(',').map(tag => tag.trim()) : undefined,
            excludeTags: excludeTags ? excludeTags.split(',').map(tag => tag.trim()) : undefined,
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setResult(data);
        toast({
          title: "Success",
          description: `Website crawled successfully. Found ${data.data?.data?.length || 0} pages`,
        });
      } else {
        throw new Error(data.error || 'Failed to crawl website');
      }
    } catch (error) {
      console.error('Error crawling website:', error);
      setResult({ success: false, error: error.message || 'Failed to crawl website' });
      toast({
        title: "Error",
        description: error.message || "Failed to crawl website",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadData = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Firecrawl Website Scraper
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isLoading}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scrape">Single Page Scrape</TabsTrigger>
              <TabsTrigger value="crawl">Full Site Crawl</TabsTrigger>
            </TabsList>
            
            <TabsContent value="scrape" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="main-content"
                    checked={onlyMainContent}
                    onCheckedChange={setOnlyMainContent}
                  />
                  <Label htmlFor="main-content">Extract only main content</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="include-tags">Include Tags (comma-separated)</Label>
                    <Input
                      id="include-tags"
                      value={includeTags}
                      onChange={(e) => setIncludeTags(e.target.value)}
                      placeholder="article, main, content"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exclude-tags">Exclude Tags (comma-separated)</Label>
                    <Input
                      id="exclude-tags"
                      value={excludeTags}
                      onChange={(e) => setExcludeTags(e.target.value)}
                      placeholder="nav, footer, aside"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleScrape} 
                  disabled={isLoading || !url}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    'Scrape Page'
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="crawl" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="crawl-limit">Page Limit</Label>
                  <Input
                    id="crawl-limit"
                    type="number"
                    value={crawlLimit}
                    onChange={(e) => setCrawlLimit(parseInt(e.target.value) || 10)}
                    min="1"
                    max="100"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="crawl-main-content"
                    checked={onlyMainContent}
                    onCheckedChange={setOnlyMainContent}
                  />
                  <Label htmlFor="crawl-main-content">Extract only main content</Label>
                </div>

                <Button 
                  onClick={handleCrawl} 
                  disabled={isLoading || !url}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Crawling...
                    </>
                  ) : (
                    'Crawl Website'
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Results
              {result.success && result.data?.data && (
                <Badge variant="secondary">
                  {Array.isArray(result.data.data) ? `${result.data.data.length} pages` : '1 page'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-4">
                {activeTab === 'scrape' && result.data?.data && (
                  <div className="space-y-4">
                    {result.data.data.metadata && (
                      <div className="space-y-2">
                        <h3 className="font-semibold">Page Information</h3>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          {result.data.data.metadata.title && (
                            <p><strong>Title:</strong> {result.data.data.metadata.title}</p>
                          )}
                          {result.data.data.metadata.description && (
                            <p><strong>Description:</strong> {result.data.data.metadata.description}</p>
                          )}
                          {result.data.data.metadata.url && (
                            <p className="flex items-center gap-2">
                              <strong>URL:</strong> 
                              <a 
                                href={result.data.data.metadata.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {result.data.data.metadata.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Extracted Content</h3>
                        <div className="space-x-2">
                          {result.data.data.markdown && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadData(result.data.data.markdown, 'scraped-content.md')}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download MD
                            </Button>
                          )}
                          {result.data.data.html && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadData(result.data.data.html, 'scraped-content.html')}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download HTML
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <Textarea
                        value={result.data.data.markdown || result.data.data.html || 'No content extracted'}
                        readOnly
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'crawl' && result.data?.data?.data && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Crawled Pages</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const allContent = result.data.data.data
                            .map((page: any, index: number) => 
                              `## Page ${index + 1}: ${page.metadata?.title || page.metadata?.url || 'Unknown'}\n\n${page.markdown || page.html || 'No content'}\n\n---\n\n`
                            )
                            .join('');
                          downloadData(allContent, 'crawled-content.md');
                        }}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download All
                      </Button>
                    </div>
                    
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {result.data.data.data.map((page: any, index: number) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">
                                {page.metadata?.title || `Page ${index + 1}`}
                              </h4>
                              {page.metadata?.url && (
                                <a 
                                  href={page.metadata.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {page.metadata?.description || 'No description available'}
                            </p>
                            <Textarea
                              value={(page.markdown || page.html || 'No content').substring(0, 300) + '...'}
                              readOnly
                              className="h-20 text-xs"
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600">
                <p className="font-semibold">Error:</p>
                <p>{result.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};