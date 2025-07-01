
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserDocumentInsert = Database['public']['Tables']['user_documents']['Insert'];
type UserDocumentRow = Database['public']['Tables']['user_documents']['Row'];
type UserFavoriteInsert = Database['public']['Tables']['user_favorites']['Insert'];
type UserFavoriteRow = Database['public']['Tables']['user_favorites']['Row'];

export const userDocumentService = {
  async addPurchase(documentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_documents')
      .insert({
        user_id: user.id,
        document_id: documentId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async getUserPurchases() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_documents')
      .select(`
        *,
        documents:document_id (
          id,
          title,
          description,
          category,
          subcategory,
          file_name,
          price,
          thumbnail_url
        )
      `)
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async updateDownloadCount(documentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .rpc('increment_download_count', {
        doc_id: documentId,
        user_id: user.id
      });

    if (error) {
      throw error;
    }

    return data;
  },

  async addToFavorites(documentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: user.id,
        document_id: documentId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async removeFromFavorites(documentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('document_id', documentId);

    if (error) {
      throw error;
    }
  },

  async getUserFavorites() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        *,
        documents:document_id (
          id,
          title,
          description,
          category,
          subcategory,
          file_name,
          price,
          thumbnail_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  async checkIfFavorite(documentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('document_id', documentId)
      .maybeSingle();

    if (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }

    return !!data;
  }
};
