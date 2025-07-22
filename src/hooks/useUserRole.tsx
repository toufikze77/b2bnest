
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['app_role'];

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      console.log('🔍 Fetching user role for user:', user?.id);
      
      if (!user) {
        console.log('❌ No user found, setting role to null');
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        console.log('📊 User role query result:', { data, error });

        if (error) {
          console.error('❌ Error fetching user role:', error);
          // Check if no rows found, default to user role
          if (error.code === 'PGRST116') {
            console.log('🔧 No role found, defaulting to user');
            setRole('user');
          } else {
            setRole('user'); // Default to user role on other errors
          }
        } else {
          console.log('✅ User role found:', data.role);
          setRole(data.role);
        }
      } catch (error) {
        console.error('❌ Error in fetchUserRole:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || role === 'owner';
  const canUpload = isAdmin;
  const canModify = isAdmin;

  console.log('🎯 Role computed values:', {
    role,
    isOwner,
    isAdmin,
    canUpload,
    canModify,
    loading
  });

  return {
    role,
    loading,
    isOwner,
    isAdmin,
    canUpload,
    canModify
  };
};
