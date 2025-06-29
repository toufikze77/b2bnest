
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];

export const documentService = {
  async uploadDocument(documentData: Omit<DocumentInsert, 'user_id'>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        ...documentData,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async getDocuments(category?: string) {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;
  },

  async updateDocument(id: string, updates: Partial<DocumentRow>) {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteDocument(id: string) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
};
