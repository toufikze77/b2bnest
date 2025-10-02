import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_profile?: {
    full_name?: string;
    display_name?: string;
    email?: string;
  };
}

interface TodoCommentsProps {
  todoId: string;
}

export const TodoComments: React.FC<TodoCommentsProps> = ({ todoId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();

    // Subscribe to real-time updates for comments
    const channel = supabase
      .channel(`todo-comments-${todoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_comments',
          filter: `todo_id=eq.${todoId}`
        },
        () => {
          fetchComments(); // Refetch comments when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todoId]);

  const fetchComments = async () => {
    try {
      // First, fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('todo_comments')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];

      // Use secure function to get display info
      const { batchGetUserDisplayInfo } = await import('@/utils/profileUtils');
      const profilesData = await batchGetUserDisplayInfo(userIds);

      if (!profilesData || profilesData.length === 0) {
        console.error('No profiles returned');
        // Still show comments without user info if profiles fail
        setComments(commentsData.map(comment => ({ ...comment, user_profile: null })));
        return;
      }

      // Create a map of user profiles by ID
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      );

      // Merge comments with user profiles
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        user_profile: profilesMap.get(comment.user_id) || null
      }));

      setComments(commentsWithProfiles);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    }
  };

  const addComment = async () => {
    if (!user || !newComment.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      fetchComments();
      toast({
        title: "Success",
        description: "Comment added successfully!"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('todo_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      fetchComments();
      toast({
        title: "Success",
        description: "Comment deleted successfully!"
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment.",
        variant: "destructive"
      });
    }
  };

  const getUserDisplayName = (comment: Comment) => {
    if (comment.user_profile?.display_name) {
      return comment.user_profile.display_name;
    }
    if (comment.user_profile?.full_name) {
      return comment.user_profile.full_name;
    }
    if (comment.user_profile?.email) {
      return comment.user_profile.email.split('@')[0];
    }
    return 'User';
  };

  const getUserInitials = (comment: Comment) => {
    const name = getUserDisplayName(comment);
    if (name === 'User') return 'U';
    
    const words = name.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 bg-muted/30 rounded-lg border">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getUserInitials(comment)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {getUserDisplayName(comment)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {user && comment.user_id === user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {user && (
        <div className="border-t pt-4 flex-shrink-0 px-1">
          <div className="flex gap-2 w-full">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none flex-1 border-border"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <Button 
              onClick={addComment} 
              disabled={!newComment.trim() || loading}
              size="sm"
              className="self-end"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press Ctrl+Enter to send
          </p>
        </div>
      )}
    </div>
  );
};