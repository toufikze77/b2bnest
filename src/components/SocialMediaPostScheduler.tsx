import React, { useState } from 'react';
import { Calendar, Clock, Users, Image, Hash, Send, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  scheduledDate: string;
  scheduledTime: string;
  hashtags: string[];
  image: string;
  status: 'scheduled' | 'published' | 'draft';
  createdAt: Date;
}

const SocialMediaPostScheduler = () => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [formData, setFormData] = useState({
    content: '',
    platform: 'twitter',
    scheduledDate: '',
    scheduledTime: '',
    hashtags: '',
    image: ''
  });
  const { toast } = useToast();

  const platforms = [
    { value: 'twitter', label: 'Twitter/X', icon: '𝕏' },
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'instagram', label: 'Instagram', icon: '📷' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' }
  ];

  const schedulePost = () => {
    if (!formData.content || !formData.scheduledDate || !formData.scheduledTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in content, date, and time.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 10 scheduled posts max
    if (posts.length >= 10) {
      toast({
        title: "Post Limit Reached",
        description: "Free plan allows up to 10 scheduled posts. Upgrade for unlimited scheduling.",
        variant: "destructive"
      });
      return;
    }

    const hashtagArray = formData.hashtags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

    const post: ScheduledPost = {
      id: Date.now().toString(),
      content: formData.content,
      platform: formData.platform,
      scheduledDate: formData.scheduledDate,
      scheduledTime: formData.scheduledTime,
      hashtags: hashtagArray,
      image: formData.image,
      status: 'scheduled',
      createdAt: new Date()
    };

    setPosts(prev => [post, ...prev]);
    setFormData({
      content: '',
      platform: 'twitter',
      scheduledDate: '',
      scheduledTime: '',
      hashtags: '',
      image: ''
    });

    toast({
      title: "Post Scheduled",
      description: `Post scheduled for ${formData.platform} on ${formData.scheduledDate} at ${formData.scheduledTime}.`
    });
  };

  const deletePost = (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
    toast({
      title: "Post Deleted",
      description: "Scheduled post has been removed."
    });
  };

  const getPlatformIcon = (platform: string) => {
    const platformData = platforms.find(p => p.value === platform);
    return platformData?.icon || '📱';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCharacterLimit = (platform: string) => {
    switch (platform) {
      case 'twitter': return 280;
      case 'facebook': return 63206;
      case 'instagram': return 2200;
      case 'linkedin': return 3000;
      case 'tiktok': return 150;
      default: return 280;
    }
  };

  const remainingChars = getCharacterLimit(formData.platform) - formData.content.length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Social Media Post Scheduler</h1>
        <p className="text-gray-600">Schedule and manage your social media posts across multiple platforms</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 10 scheduled posts maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Scheduler Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule New Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="platform">Platform</Label>
                <Select value={formData.platform} onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        <div className="flex items-center gap-2">
                          <span>{platform.icon}</span>
                          {platform.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="content">Post Content *</Label>
                <Textarea
                  id="content"
                  placeholder="What's on your mind?"
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className={remainingChars < 0 ? 'border-red-500' : ''}
                />
                <div className={`text-xs mt-1 ${remainingChars < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {remainingChars} characters remaining
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scheduledDate">Date *</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="scheduledTime">Time *</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="hashtags">Hashtags</Label>
                <Input
                  id="hashtags"
                  placeholder="business, marketing, success (comma separated)"
                  value={formData.hashtags}
                  onChange={(e) => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Separate multiple hashtags with commas
                </div>
              </div>

              <div>
                <Label htmlFor="image">Image URL (optional)</Label>
                <Input
                  id="image"
                  placeholder="https://example.com/image.jpg"
                  value={formData.image}
                  onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                />
              </div>

              <Button 
                onClick={schedulePost} 
                className="w-full"
                disabled={posts.length >= 10 || remainingChars < 0}
              >
                <Send className="h-4 w-4 mr-2" />
                {posts.length >= 10 ? 'Limit Reached' : 'Schedule Post'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Post Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-white min-h-48">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{getPlatformIcon(formData.platform)}</span>
                <span className="font-semibold capitalize">{formData.platform}</span>
                {formData.scheduledDate && formData.scheduledTime && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    {formData.scheduledDate} at {formData.scheduledTime}
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="text-sm">
                  {formData.content || 'Your post content will appear here...'}
                </div>
                
                {formData.hashtags && (
                  <div className="flex flex-wrap gap-1">
                    {formData.hashtags.split(',').map((tag, index) => (
                      <span key={index} className="text-xs text-blue-600">
                        {tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`}
                      </span>
                    ))}
                  </div>
                )}
                
                {formData.image && (
                  <div className="border rounded overflow-hidden">
                    <img src={formData.image} alt="Post" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No posts scheduled yet. Create your first scheduled post above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getPlatformIcon(post.platform)}</span>
                      <span className="font-semibold capitalize">{post.platform}</span>
                      <Badge className={getStatusColor(post.status)}>
                        {post.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePost(post.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-sm mb-2">
                    {post.content}
                  </div>
                  
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.hashtags.map((tag, index) => (
                        <span key={index} className="text-xs text-blue-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.scheduledDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.scheduledTime}
                      </span>
                    </div>
                    <span>Created: {post.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Note about Social Media Integration</h4>
              <p className="text-sm text-blue-700">
                This tool helps you plan and organize your social media content. To actually publish posts automatically, 
                you would need to integrate with each platform's API or use a service like Zapier, Buffer, or Hootsuite.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialMediaPostScheduler;