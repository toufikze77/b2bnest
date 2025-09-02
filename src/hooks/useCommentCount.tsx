import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useCommentCount = (todoId: string) => {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (!todoId) return;

    const fetchCommentCount = async () => {
      try {
        const { count, error } = await supabase
          .from('todo_comments')
          .select('*', { count: 'exact', head: true })
          .eq('todo_id', todoId);

        if (error) {
          console.error('Error fetching comment count:', error);
          return;
        }

        setCommentCount(count || 0);
      } catch (error) {
        console.error('Error fetching comment count:', error);
        setCommentCount(0);
      }
    };

    fetchCommentCount();

    // Subscribe to real-time updates for comment count
    const channel = supabase
      .channel(`todo-comments-count-${todoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_comments',
          filter: `todo_id=eq.${todoId}`
        },
        () => {
          fetchCommentCount(); // Refetch count when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todoId]);

  return commentCount;
};