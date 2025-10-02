import { supabase } from "@/integrations/supabase/client";

export interface UserDisplayInfo {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
}

/**
 * Safely fetch user display information using the security definer function.
 * This prevents "permission denied" errors while maintaining privacy.
 */
export async function getUserDisplayInfo(userId: string): Promise<UserDisplayInfo | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_display_info', { p_user_id: userId });
    
    if (error) {
      console.error('Error fetching user display info:', error);
      return null;
    }
    
    // RPC returns a table (array), get first result
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error in getUserDisplayInfo:', error);
    return null;
  }
}

/**
 * Batch fetch user display information for multiple users.
 * Makes parallel RPC calls for better performance.
 */
export async function batchGetUserDisplayInfo(userIds: string[]): Promise<UserDisplayInfo[]> {
  if (userIds.length === 0) return [];
  
  try {
    // Make parallel RPC calls for all users
    const promises = userIds.map(userId => getUserDisplayInfo(userId));
    const results = await Promise.all(promises);
    
    // Filter out nulls and return valid results
    return results.filter((result): result is UserDisplayInfo => result !== null);
  } catch (error) {
    console.error('Error in batchGetUserDisplayInfo:', error);
    return [];
  }
}
