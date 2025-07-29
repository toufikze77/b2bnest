import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NewsArticle {
  title: string;
  description?: string;
  content?: string;
  link: string;
  published_at?: string;
  source: string;
  category?: string;
  image_url?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting news fetch process...');

    // Yahoo Finance RSS feeds for business news
    const rssFeeds = [
      {
        url: 'https://feeds.finance.yahoo.com/rss/2.0/headline',
        category: 'Finance'
      },
      {
        url: 'https://feeds.finance.yahoo.com/rss/2.0/category-tech',
        category: 'Technology'
      },
      {
        url: 'https://feeds.finance.yahoo.com/rss/2.0/category-earnings',
        category: 'Earnings'
      },
      {
        url: 'https://feeds.finance.yahoo.com/rss/2.0/category-markets',
        category: 'Markets'
      },
      {
        url: 'https://feeds.finance.yahoo.com/rss/2.0/category-investing',
        category: 'Investing'
      }
    ];

    let totalArticles = 0;
    let newArticles = 0;

    for (const feed of rssFeeds) {
      try {
        console.log(`Fetching RSS feed: ${feed.url}`);
        
        // Fetch RSS feed
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'B2BNest News Aggregator 1.0'
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
          continue;
        }

        const rssText = await response.text();
        console.log(`Retrieved RSS content, length: ${rssText.length}`);

        // Parse RSS XML manually
        const articles = parseRSSFeed(rssText, feed.category, feed.url);
        console.log(`Parsed ${articles.length} articles from ${feed.category} feed`);

        totalArticles += articles.length;

        // Insert articles into database
        for (const article of articles) {
          try {
            const { error } = await supabase
              .from('news_articles')
              .upsert(article, { 
                onConflict: 'link',
                ignoreDuplicates: true 
              });

            if (error) {
              console.error('Error inserting article:', error);
            } else {
              newArticles++;
            }
          } catch (insertError) {
            console.error('Insert error:', insertError);
          }
        }
      } catch (feedError) {
        console.error(`Error processing feed ${feed.url}:`, feedError);
      }
    }

    const result = {
      success: true,
      message: `Processed ${totalArticles} total articles, ${newArticles} new articles added`,
      totalArticles,
      newArticles,
      timestamp: new Date().toISOString()
    };

    console.log('News fetch completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-news function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseRSSFeed(rssText: string, category: string, feedUrl: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  
  try {
    // Simple regex-based RSS parsing for basic feeds
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = rssText.match(itemRegex) || [];

    for (const item of items) {
      try {
        const title = extractTagContent(item, 'title');
        const link = extractTagContent(item, 'link') || extractTagContent(item, 'guid');
        const description = extractTagContent(item, 'description');
        const pubDate = extractTagContent(item, 'pubDate');
        const content = extractTagContent(item, 'content:encoded') || description;

        // Extract image URL from description or content
        const imageMatch = item.match(/<img[^>]+src="([^"]+)"/i);
        const imageUrl = imageMatch ? imageMatch[1] : null;

        // Determine source from feed URL
        let source = 'Yahoo Finance';
        if (feedUrl.includes('yahoo.com') || feedUrl.includes('finance.yahoo.com')) {
          source = 'Yahoo Finance';
        }

        if (title && link) {
          articles.push({
            title: cleanText(title),
            description: description ? cleanText(description) : undefined,
            content: content ? cleanText(content) : undefined,
            link: link.trim(),
            published_at: pubDate ? new Date(pubDate).toISOString() : undefined,
            source,
            category,
            image_url: imageUrl
          });
        }
      } catch (itemError) {
        console.error('Error parsing RSS item:', itemError);
      }
    }
  } catch (parseError) {
    console.error('Error parsing RSS feed:', parseError);
  }

  return articles;
}

function extractTagContent(text: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Remove CDATA
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}