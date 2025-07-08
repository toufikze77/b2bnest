import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Users, Calendar, Filter, Pin, Reply, Search, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: 'startup' | 'marketing' | 'finance' | 'legal' | 'operations' | 'hr' | 'sales' | 'technology' | 'networking' | 'general';
  is_pinned: boolean;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface ForumReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const Forum = () => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'general' as const
  });
  const [newReply, setNewReply] = useState('');
  const { toast } = useToast();

  const categories = [
    { value: 'all', label: 'All Categories', color: 'bg-gray-500' },
    { value: 'startup', label: 'Startup', color: 'bg-blue-500' },
    { value: 'marketing', label: 'Marketing', color: 'bg-green-500' },
    { value: 'finance', label: 'Finance', color: 'bg-yellow-500' },
    { value: 'legal', label: 'Legal', color: 'bg-red-500' },
    { value: 'operations', label: 'Operations', color: 'bg-purple-500' },
    { value: 'hr', label: 'HR', color: 'bg-pink-500' },
    { value: 'sales', label: 'Sales', color: 'bg-orange-500' },
    { value: 'technology', label: 'Technology', color: 'bg-indigo-500' },
    { value: 'networking', label: 'Networking', color: 'bg-teal-500' },
    { value: 'general', label: 'General', color: 'bg-gray-500' }
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, searchTerm]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('forum_posts')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('is_pinned', { ascending: false })
        .order('last_reply_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory as any);
      }

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts((data as any) || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load forum posts.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('forum_replies')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReplies((data as any) || []);
    } catch (error) {
      console.error('Error fetching replies:', error);
      toast({
        title: "Error",
        description: "Failed to load replies.",
        variant: "destructive"
      });
    }
  };

  const createPost = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create a post.",
        variant: "destructive"
      });
      return;
    }

    if (!newPost.title || !newPost.content) {
      toast({
        title: "Missing Information",
        description: "Please fill in both title and content.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('forum_posts')
        .insert({
          title: newPost.title,
          content: newPost.content,
          category: newPost.category as 'startup' | 'marketing' | 'finance' | 'legal' | 'operations' | 'hr' | 'sales' | 'technology' | 'networking' | 'general',
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your post has been created!"
      });

      setNewPost({ title: '', content: '', category: 'general' as const });
      setIsCreateDialogOpen(false);
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post.",
        variant: "destructive"
      });
    }
  };

  const createReply = async () => {
    if (!user || !selectedPost) {
      toast({
        title: "Authentication Required",
        description: "Please log in to reply.",
        variant: "destructive"
      });
      return;
    }

    if (!newReply.trim()) {
      toast({
        title: "Missing Content",
        description: "Please enter a reply.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('forum_replies')
        .insert({
          post_id: selectedPost.id,
          content: newReply,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your reply has been posted!"
      });

      setNewReply('');
      fetchReplies(selectedPost.id);
      fetchPosts(); // Refresh to update reply counts
    } catch (error) {
      console.error('Error creating reply:', error);
      toast({
        title: "Error",
        description: "Failed to post reply.",
        variant: "destructive"
      });
    }
  };

  const openPost = async (post: ForumPost) => {
    setSelectedPost(post);
    await fetchReplies(post.id);
    setIsPostDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.color || 'bg-gray-500';
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserDisplayName = (post: ForumPost | ForumReply) => {
    return post.profiles?.full_name || post.profiles?.email || 'Anonymous User';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Business Forum</h1>
              <p className="text-gray-600 text-lg">
                Connect, share experiences, and support each other in your business journey
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2" disabled={!user}>
                  <Plus className="h-4 w-4" />
                  {user ? 'New Post' : 'Login to Post'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Forum Post</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter your post title..."
                      value={newPost.title}
                      onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={newPost.category} 
                      onValueChange={(value: any) => setNewPost(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(cat => cat.value !== 'all').map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      placeholder="Share your thoughts, ask questions, or start a discussion..."
                      rows={6}
                      value={newPost.content}
                      onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={createPost} className="flex-1">
                      Create Post
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="min-w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                        {category.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Forum Posts */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading forum posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Posts Found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No posts match your current filters. Try adjusting your search or category.'
                  : 'Be the first to start a discussion in the forum!'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <div className="space-y-3">
                  {user ? (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Post
                    </Button>
                  ) : (
                    <Link to="/auth">
                      <Button>
                        <LogIn className="h-4 w-4 mr-2" />
                        Login to Create Post
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card 
                key={post.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openPost(post)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {post.is_pinned && (
                        <Pin className="h-4 w-4 text-orange-500" />
                      )}
                      <Badge className={`text-white ${getCategoryColor(post.category)}`}>
                        {getCategoryLabel(post.category)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(post.created_at)}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {post.content}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {getUserDisplayName(post)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Reply className="h-4 w-4" />
                        {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                      </span>
                    </div>
                    {post.last_reply_at && (
                      <span>Last reply: {formatDate(post.last_reply_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Post Detail Dialog */}
        <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {selectedPost && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    {selectedPost.is_pinned && (
                      <Pin className="h-5 w-5 text-orange-500" />
                    )}
                    <Badge className={`text-white ${getCategoryColor(selectedPost.category)}`}>
                      {getCategoryLabel(selectedPost.category)}
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl">{selectedPost.title}</DialogTitle>
                  <div className="text-sm text-gray-500 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {getUserDisplayName(selectedPost)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(selectedPost.created_at)}
                    </span>
                  </div>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                  </div>
                  
                  {/* Replies */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold mb-4">
                      Replies ({replies.length})
                    </h4>
                    
                    <div className="space-y-4 mb-6">
                      {replies.map((reply) => (
                        <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {getUserDisplayName(reply)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Reply Form */}
                    <div className="space-y-3">
                      <Label htmlFor="reply">Add a reply</Label>
                      <Textarea
                        id="reply"
                        placeholder="Share your thoughts or help answer this question..."
                        rows={4}
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                      />
                      <Button onClick={createReply} disabled={!user}>
                        <Reply className="h-4 w-4 mr-2" />
                        {user ? 'Post Reply' : (
                          <Link to="/auth" className="flex items-center">
                            <LogIn className="h-4 w-4 mr-2" />
                            Login to Reply
                          </Link>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Forum;