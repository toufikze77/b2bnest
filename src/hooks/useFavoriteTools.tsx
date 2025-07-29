import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useFavoriteTools = () => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_favorite_tools')
        .select('tool_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setFavorites(data?.map(item => item.tool_id) || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (toolId: string) => {
    if (!user) {
      toast.error('Please sign in to manage favorites');
      return;
    }

    const isFavorited = favorites.includes(toolId);

    try {
      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorite_tools')
          .delete()
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) throw error;

        setFavorites(prev => prev.filter(id => id !== toolId));
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorite_tools')
          .insert({
            user_id: user.id,
            tool_id: toolId
          });

        if (error) throw error;

        setFavorites(prev => [...prev, toolId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const isFavorited = (toolId: string) => favorites.includes(toolId);

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorited,
    fetchFavorites
  };
};