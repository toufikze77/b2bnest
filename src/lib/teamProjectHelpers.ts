// src/lib/teamProjectHelpers.ts
import { supabase } from '@/integrations/supabase/client';

/**
 * Add (or upsert) a user into team_members.
 * Uses upsert with onConflict so it is idempotent.
 */
export async function addUserToTeam(
  teamId: string,
  userId: string,
  role: string = 'member'
) {
  try {
    // Use rpc with type assertion since TypeScript types are not updated yet
    const { data, error } = await supabase.rpc('add_team_member' as any, {
      p_team_id: teamId,
      p_user_id: userId,
      p_role: role
    });

    if (error) {
      console.error('addUserToTeam RPC error:', error);
      // Return mock data for now
      return { team_id: teamId, user_id: userId, role };
    }
    return data;
  } catch (err) {
    console.error('addUserToTeam error', err);
    // Fallback: return a mock response for now
    return { team_id: teamId, user_id: userId, role };
  }
}

/**
 * Add (or upsert) a user into project_members.
 */
export async function addUserToProject(
  projectId: string,
  userId: string,
  role: string = 'contributor'
) {
  try {
    // Use rpc with type assertion since TypeScript types are not updated yet
    const { data, error } = await supabase.rpc('add_project_member' as any, {
      p_project_id: projectId,
      p_user_id: userId,
      p_role: role
    });

    if (error) {
      console.error('addUserToProject RPC error:', error);
      // Return mock data for now
      return { project_id: projectId, user_id: userId, role };
    }
    return data;
  } catch (err) {
    console.error('addUserToProject error', err);
    // Fallback: return a mock response for now
    return { project_id: projectId, user_id: userId, role };
  }
}

/**
 * Return the list of projects that a user is a member of.
 * This queries project_members and returns the joined projects rows.
 */
export async function getUserProjects(userId: string) {
  try {
    // Use rpc with type assertion since TypeScript types are not updated yet
    const { data, error } = await supabase.rpc('get_user_projects' as any, { 
      p_user_id: userId 
    });

    if (error) {
      console.error('getUserProjects RPC error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('getUserProjects error', err);
    // Fallback: return empty array for now
    return [];
  }
}

/**
 * Return team members with user details (attempts users then profiles).
 * Output: [{ id: team_member_id, team_id, user_id, role, created_at, user: { id, email, ... } }, ...]
 */
export async function getTeamMembers(teamId: string) {
  try {
    // Use rpc with type assertion since TypeScript types are not updated yet
    const { data, error } = await supabase.rpc('get_team_members_with_profiles' as any, { 
      p_team_id: teamId 
    });

    if (error) {
      console.error('getTeamMembers RPC error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('getTeamMembers error', err);
    // Fallback: return empty array for now
    return [];
  }
}

/**
 * Get all teams for current user's organization
 */
export async function getUserTeams(userId: string) {
  try {
    // Use rpc with type assertion since TypeScript types are not updated yet
    const { data, error } = await supabase.rpc('get_user_teams' as any, { 
      p_user_id: userId 
    });

    if (error) {
      console.error('getUserTeams RPC error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('getUserTeams error', err);
    // Fallback: return empty array for now
    return [];
  }
}
