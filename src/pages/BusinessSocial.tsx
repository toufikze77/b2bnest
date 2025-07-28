import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Calendar, 
  MapPin, 
  Users, 
  TrendingUp, 
  UserPlus,
  Building,
  Briefcase,
  Send,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Image,
  Building2,
  Globe,
  Megaphone,
  Star,
  DollarSign,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  industry: string | null;
  company: string | null;
  position: string | null;
  bio: string | null;
  connection_count: number;
}

interface SocialPost {
  id: string;
  content: string;
  post_type: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  user_id: string;
  profiles?: Profile;
  user_liked?: boolean;
}

interface PostComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: Profile;
}

interface Advertisement {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number;
  currency: string;
  image_urls: string[];
  view_count: number;
  user_id: string;
}

const BusinessSocial = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [suggestedConnections, setSuggestedConnections] = useState<Profile[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
      fetchConnections();
      fetchConnectionRequests();
      fetchSuggestedConnections();
    }
    fetchPosts();
    fetchAdvertisements();
  }, [user]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            avatar_url,
            headline,
            location,
            industry,
            company,
            position,
            bio,
            connection_count
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which posts the current user has liked
      if (user) {
        const { data: likedPosts } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id);

        const likedPostIds = new Set(likedPosts?.map(like => like.post_id) || []);
        
        const postsWithLikes = (data as any)?.map((post: any) => ({
          ...post,
          user_liked: likedPostIds.has(post.id)
        })) || [];

        setPosts(postsWithLikes);
      } else {
        setPosts((data as any) || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvertisements = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      setAdvertisements(data || []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
    }
  };

  const createPost = async () => {
    if (!user || !newPost.trim()) return;

    try {
      const { error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content: newPost,
          post_type: 'post'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your post has been shared!"
      });

      setNewPost('');
      setIsCreatePostOpen(false);
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

  const editPost = async () => {
    if (!user || !editPostContent.trim() || !editingPost) return;

    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ content: editPostContent })
        .eq('id', editingPost.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your post has been updated!"
      });

      setEditPostContent('');
      setIsEditPostOpen(false);
      setEditingPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error",
        description: "Failed to update post.",
        variant: "destructive"
      });
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your post has been deleted."
      });

      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post.",
        variant: "destructive"
      });
    }
  };

  const openEditPost = (post: any) => {
    setEditingPost(post);
    setEditPostContent(post.content);
    setIsEditPostOpen(true);
  };

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to like posts.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);
      } else {
        await supabase
          .from('post_likes')
          .insert({
            user_id: user.id,
            post_id: postId
          });
      }

      fetchPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like.",
        variant: "destructive"
      });
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPostComments((data as any) || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const createComment = async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          user_id: user.id,
          post_id: selectedPost.id,
          content: newComment
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedPost.id);
      fetchPosts();
    } catch (error) {
      console.error('Error creating comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive"
      });
    }
  };

  const openComments = async (post: SocialPost) => {
    setSelectedPost(post);
    await fetchComments(post.id);
    setIsCommentsOpen(true);
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

  const getUserDisplayName = (profile: Profile | undefined) => {
    return profile?.full_name || profile?.email || 'Anonymous User';
  };

  const getUserInitials = (profile: Profile | undefined) => {
    const name = getUserDisplayName(profile);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Connection functions
  const fetchConnections = async () => {
    if (!user) return;
    
    try {
      // First get the connections without joins
      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get all unique user IDs from connections
        const userIds = new Set();
        data.forEach(conn => {
          userIds.add(conn.requester_id);
          userIds.add(conn.addressee_id);
        });
        userIds.delete(user.id); // Remove current user
        
        // Fetch profiles for all connected users
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIds) as string[]);
          
        if (!profileError) {
          // Combine connection data with profiles
          const connectionsWithProfiles = data.map(conn => ({
            ...conn,
            requester: profiles?.find(p => p.id === conn.requester_id),
            addressee: profiles?.find(p => p.id === conn.addressee_id)
          }));
          setConnections(connectionsWithProfiles);
        } else {
          setConnections(data);
        }
      } else {
        setConnections([]);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const fetchConnectionRequests = async () => {
    if (!user) return;
    
    try {
      // First, let's fetch without the join to see if we get any data
      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      
      console.log('Connection requests fetched:', data);
      
      // If we have requests, fetch the profile data separately
      if (data && data.length > 0) {
        const requesterIds = data.map(req => req.requester_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', requesterIds);
          
        if (!profileError) {
          // Combine the data
          const requestsWithProfiles = data.map(request => ({
            ...request,
            requester: profiles?.find(p => p.id === request.requester_id)
          }));
          setConnectionRequests(requestsWithProfiles);
        } else {
          setConnectionRequests(data);
        }
      } else {
        setConnectionRequests([]);
      }
    } catch (error) {
      console.error('Error fetching connection requests:', error);
    }
  };

  const fetchSuggestedConnections = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .limit(5);

      if (error) throw error;
      setSuggestedConnections(data || []);
    } catch (error) {
      console.error('Error fetching suggested connections:', error);
    }
  };

  const sendConnectionRequest = async (addresseeId: string) => {
    if (!user) return;

    try {
      // First check if connection already exists
      const { data: existingConnection, error: checkError } = await supabase
        .from('connections')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingConnection) {
        toast({
          title: "Info",
          description: "Connection request already exists or you are already connected.",
          variant: "default"
        });
        return;
      }

      const { error } = await supabase
        .from('connections')
        .insert({
          requester_id: user.id,
          addressee_id: addresseeId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Connection request sent!"
      });

      fetchSuggestedConnections();
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast({
        title: "Error",
        description: "Failed to send connection request.",
        variant: "destructive"
      });
    }
  };

  const acceptConnectionRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Connection request accepted!"
      });

      fetchConnections();
      fetchConnectionRequests();
    } catch (error) {
      console.error('Error accepting connection:', error);
      toast({
        title: "Error",
        description: "Failed to accept connection request.",
        variant: "destructive"
      });
    }
  };

  // Messaging functions
  const fetchMessages = async (conversationUserId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(*),
          receiver:profiles!messages_receiver_id_fkey(*)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conversationUserId}),and(sender_id.eq.${conversationUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content: newMessage
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive"
      });
    }
  };

  const openConversation = async (connectionProfile: Profile) => {
    setSelectedConversation(connectionProfile);
    await fetchMessages(connectionProfile.id);
    setIsMessagesOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Business Social Network</h1>
          <p className="text-gray-600 text-lg">
            Connect with professionals, share insights, and grow your network - completely free!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Profile */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardContent className="p-6 text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback>{getUserInitials(profile || undefined)}</AvatarFallback>
                </Avatar>
                
                {user ? (
                  <>
                    <h3 className="font-semibold text-lg mb-1">
                      {getUserDisplayName(profile || undefined)}
                    </h3>
                    {profile?.headline && (
                      <p className="text-gray-600 text-sm mb-2">{profile.headline}</p>
                    )}
                    {profile?.company && profile?.position && (
                      <p className="text-gray-500 text-sm mb-2">
                        {profile.position} at {profile.company}
                      </p>
                    )}
                    {profile?.location && (
                      <p className="text-gray-500 text-sm flex items-center justify-center gap-1 mb-3">
                        <MapPin className="h-3 w-3" />
                        {profile.location}
                      </p>
                    )}
                     <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-4">
                       <span className="flex items-center gap-1">
                         <Users className="h-4 w-4" />
                         {connections.length} connections
                       </span>
                     </div>
                     
                     <div className="space-y-2">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="w-full"
                         onClick={() => setIsConnectionsOpen(true)}
                       >
                         <Users className="h-4 w-4 mr-2" />
                         Connections
                       </Button>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="w-full"
                         onClick={() => setIsMessagesOpen(true)}
                       >
                         <MessageCircle className="h-4 w-4 mr-2" />
                         Messages
                       </Button>
                     </div>
                  </>
                ) : (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Join the Network</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Connect with professionals worldwide
                    </p>
                    <Link to="/auth">
                      <Button className="w-full">
                        Sign Up Free
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trending Topics */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">#RemoteWork</h4>
                    <p className="text-blue-700 text-sm">1,234 posts this week</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900">#StartupLife</h4>
                    <p className="text-green-700 text-sm">892 posts this week</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900">#TechTrends</h4>
                    <p className="text-purple-700 text-sm">756 posts this week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Requests */}
            {connectionRequests.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Connection Requests ({connectionRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {connectionRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={request.requester?.avatar_url || ''} />
                            <AvatarFallback>{getUserInitials(request.requester)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{getUserDisplayName(request.requester)}</p>
                            <p className="text-xs text-gray-600">{request.requester?.headline}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => acceptConnectionRequest(request.id)}>
                          Accept
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Connections */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  People You May Know
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suggestedConnections.slice(0, 3).map((person) => (
                    <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={person.avatar_url || ''} />
                          <AvatarFallback>{getUserInitials(person)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{getUserDisplayName(person)}</p>
                          <p className="text-xs text-gray-600">{person.headline}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => sendConnectionRequest(person.id)}
                      >
                        Connect
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Business Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                    <h4 className="font-medium text-orange-900 flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Banking & Finance
                    </h4>
                    <p className="text-orange-700 text-sm">Trusted financial partners</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Professional Services
                    </h4>
                    <p className="text-blue-700 text-sm">Legal & accounting experts</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                    <h4 className="font-medium text-green-900 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Business Connectivity
                    </h4>
                    <p className="text-green-700 text-sm">Network & communication</p>
                  </div>
                </div>
                <div className="pt-3 border-t mt-4">
                  <Link to="/business-tools">
                    <Button variant="outline" size="sm" className="w-full">
                      View All Resources
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-2">
            {/* Create Post */}
            {user && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback>{getUserInitials(profile || undefined)}</AvatarFallback>
                    </Avatar>
                    <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="flex-1 justify-start text-gray-500"
                        >
                          Share your professional insights...
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create a Post</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="What would you like to share with your network?"
                            rows={4}
                            value={newPost}
                            onChange={(e) => setNewPost(e.target.value)}
                          />
                          <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm">
                                <Image className="h-4 w-4 mr-2" />
                                Photo
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Building2 className="h-4 w-4 mr-2" />
                                Company
                              </Button>
                            </div>
                            <Button onClick={createPost} disabled={!newPost.trim()}>
                              <Send className="h-4 w-4 mr-2" />
                              Post
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Posts Feed */}
            <div className="space-y-6">
              {posts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
                    <p className="text-gray-600 mb-4">
                      Be the first to share something with the community!
                    </p>
                    {user && (
                      <Button onClick={() => setIsCreatePostOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Post
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                posts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      {/* Post Header with Menu */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar>
                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                            <AvatarFallback>{getUserInitials(post.profiles)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">
                              {getUserDisplayName(post.profiles)}
                            </h4>
                            {post.profiles?.company && post.profiles?.position && (
                              <p className="text-gray-500 text-sm mb-1">
                                {post.profiles.position} at {post.profiles.company}
                              </p>
                            )}
                            <p className="text-gray-500 text-xs flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(post.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Post Menu - only show for user's own posts */}
                        {user && post.user_id === user.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditPost(post)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Post
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deletePost(post.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Post
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Post Content */}
                      <div className="mb-4">
                        <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                      </div>

                      {/* Post Actions */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-6">
                          <button
                            onClick={() => toggleLike(post.id, post.user_liked || false)}
                            className={`flex items-center gap-2 text-sm transition-colors ${
                              post.user_liked 
                                ? 'text-red-600 hover:text-red-700' 
                                : 'text-gray-500 hover:text-red-600'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${post.user_liked ? 'fill-current' : ''}`} />
                            {post.like_count}
                          </button>
                          
                          <button
                            onClick={() => openComments(post)}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {post.comment_count}
                          </button>
                          
                          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors">
                            <Share2 className="h-4 w-4" />
                            {post.share_count}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            {/* Premium Marketplace - Expanded */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-amber-600" />
                  Premium Marketplace
                  <Badge variant="secondary" className="ml-1">
                    <Star className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {advertisements.length > 0 ? (
                  <div className="space-y-4">
                    {advertisements.map((ad) => (
                      <div key={ad.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                          {ad.image_urls.length > 0 && (
                            <img
                              src={ad.image_urls[0]}
                              alt={ad.title}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-1">{ad.title}</h4>
                            <p className="text-xs text-gray-500 mb-1">{ad.category}</p>
                            <p className="text-xs text-gray-600 line-clamp-2">{ad.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              {ad.price && (
                                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                                  <DollarSign className="w-3 h-3" />
                                  {ad.price} {ad.currency}
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Eye className="w-3 h-3" />
                                {ad.view_count}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <Link to="/business-tools">
                        <Button variant="outline" size="sm" className="w-full">
                          View All Marketplace
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Megaphone className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">No premium ads yet</p>
                    <Link to="/business-tools">
                      <Button size="sm" variant="outline">
                        Explore Marketplace
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Suggested Connections */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  People You May Know
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">John Doe</h4>
                      <p className="text-gray-500 text-xs">CEO at TechCorp</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>SM</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">Sarah Miller</h4>
                      <p className="text-gray-500 text-xs">Product Manager</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Comments Modal */}
        <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedPost && (
              <>
                <DialogHeader>
                  <DialogTitle>Comments</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Original Post */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={selectedPost.profiles?.avatar_url || ''} />
                        <AvatarFallback>{getUserInitials(selectedPost.profiles)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-semibold">
                          {getUserDisplayName(selectedPost.profiles)}
                        </h4>
                        <p className="text-gray-600 text-sm mb-2">
                          {formatDate(selectedPost.created_at)}
                        </p>
                        <p className="text-gray-800">{selectedPost.content}</p>
                      </div>
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-4">
                    {postComments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={comment.profiles?.avatar_url || ''} />
                          <AvatarFallback>{getUserInitials(comment.profiles)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-sm">
                              {getUserDisplayName(comment.profiles)}
                            </h5>
                            <span className="text-gray-500 text-xs">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-800 text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Comment */}
                  {user && (
                    <div className="flex items-start gap-3 pt-4 border-t">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback>{getUserInitials(profile || undefined)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder="Write a comment..."
                          rows={2}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        />
                        <Button 
                          onClick={createComment} 
                          disabled={!newComment.trim()}
                          size="sm"
                        >
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Post Modal */}
        <Dialog open={isEditPostOpen} onOpenChange={setIsEditPostOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Textarea
                placeholder="What's on your mind?"
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                className="min-h-[120px] resize-none"
                maxLength={5000}
              />
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {editPostContent.length}/5000 characters
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditPostOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={editPost} disabled={!editPostContent.trim()}>
                    Update Post
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Connections Modal */}
        <Dialog open={isConnectionsOpen} onOpenChange={setIsConnectionsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Your Connections</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {connections.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No connections yet</p>
              ) : (
                <div className="space-y-4">
                  {connections.map((connection) => {
                    const connectionProfile = connection.requester_id === user?.id 
                      ? connection.addressee 
                      : connection.requester;
                    
                    return (
                      <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={connectionProfile?.avatar_url || ''} />
                            <AvatarFallback>{getUserInitials(connectionProfile)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getUserDisplayName(connectionProfile)}</p>
                            <p className="text-sm text-gray-600">{connectionProfile?.headline}</p>
                            <p className="text-xs text-gray-500">{connectionProfile?.company}</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openConversation(connectionProfile)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Messages Modal */}
        <Dialog open={isMessagesOpen} onOpenChange={setIsMessagesOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Messages</DialogTitle>
            </DialogHeader>
            <div className="flex h-[60vh]">
              {/* Conversations List */}
              <div className="w-1/3 border-r pr-4">
                <h3 className="font-medium mb-4">Conversations</h3>
                <div className="space-y-2">
                  {connections.map((connection) => {
                    const connectionProfile = connection.requester_id === user?.id 
                      ? connection.addressee 
                      : connection.requester;
                    
                    return (
                      <div 
                        key={connection.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${
                          selectedConversation?.id === connectionProfile?.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => openConversation(connectionProfile)}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={connectionProfile?.avatar_url || ''} />
                          <AvatarFallback>{getUserInitials(connectionProfile)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{getUserDisplayName(connectionProfile)}</p>
                          <p className="text-xs text-gray-600 truncate">{connectionProfile?.headline}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 pl-4 flex flex-col">
                {selectedConversation ? (
                  <>
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={selectedConversation?.avatar_url || ''} />
                        <AvatarFallback>{getUserInitials(selectedConversation)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getUserDisplayName(selectedConversation)}</p>
                        <p className="text-sm text-gray-600">{selectedConversation?.headline}</p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                      {messages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.sender_id === user?.id 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              message.sender_id === user?.id ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatDate(message.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 flex gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    Select a conversation to start messaging
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BusinessSocial;