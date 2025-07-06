import React, { useState, useEffect } from 'react';
import { Twitter, Heart, MessageCircle, Repeat2, ExternalLink, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
  };
}

interface TwitterData {
  data: Tweet[];
  includes?: {
    users: Array<{
      id: string;
      name: string;
      username: string;
      profile_image_url?: string;
    }>;
  };
}

const TwitterFeed = () => {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTweets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/functions/v1/twitter-feed', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tweets');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setTweets(result.data.data || []);
        if (result.data.includes?.users?.[0]) {
          setUserInfo(result.data.includes.users[0]);
        }
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to load tweets');
      }
    } catch (err: any) {
      console.error('Error fetching tweets:', err);
      setError(err.message);
      toast({
        title: "Twitter Feed Error",
        description: "Failed to load tweets. Please check your API configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTweets();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5 text-blue-500" />
            Latest Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5 text-blue-500" />
            Twitter Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Twitter className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Unable to load tweets</p>
            <Button onClick={fetchTweets} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md h-fit sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5 text-blue-500" />
          {userInfo ? (
            <div className="flex items-center gap-2">
              {userInfo.profile_image_url && (
                <img 
                  src={userInfo.profile_image_url} 
                  alt={userInfo.name}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="text-sm">@{userInfo.username}</span>
            </div>
          ) : (
            'Latest Updates'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {tweets.length === 0 ? (
          <div className="text-center py-8">
            <Twitter className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tweets to display</p>
          </div>
        ) : (
          tweets.slice(0, 5).map((tweet) => (
            <div key={tweet.id} className="border-b border-gray-100 pb-4 last:border-b-0">
              <div className="text-sm text-gray-800 mb-2 line-clamp-3">
                {tweet.text}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(tweet.created_at)}
                </div>
                
                <a
                  href={`https://twitter.com/${userInfo?.username}/status/${tweet.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {tweet.public_metrics && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatNumber(tweet.public_metrics.like_count)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Repeat2 className="h-3 w-3" />
                    {formatNumber(tweet.public_metrics.retweet_count)}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {formatNumber(tweet.public_metrics.reply_count)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {userInfo && (
          <div className="pt-2 border-t">
            <a
              href={`https://twitter.com/${userInfo.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center"
            >
              <Button variant="outline" size="sm" className="w-full">
                <Twitter className="h-4 w-4 mr-2" />
                Follow on Twitter
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TwitterFeed;