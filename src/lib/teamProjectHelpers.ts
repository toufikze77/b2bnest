// src/lib/teamProjectHelpers.ts
import { supabase } from '@/integrations/supabase/client';

/**
 * Add (or upsert) a user into organization_members (using organizations as teams).
 * Uses upsert with onConflict so it is idempotent.
 */
export async function addUserToTeam(
  organizationId: string,
  userId: string,
  role: string = 'member'
) {
  try {
    const payload = { organization_id: organizationId, user_id: userId, role };
    const { data, error } = await supabase
      .from('organization_members')
      .upsert([payload], { onConflict: 'organization_id, user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addUserToTeam error', err);
    throw err;
  }
}

/**
 * Add (or upsert) a user to project via organization membership.
 */
export async function addUserToProject(
  projectId: string,
  userId: string,
  role: string = 'contributor'
) {
  try {
    // Projects are managed through organization membership
    // First get the project's organization
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;
    if (!project?.organization_id) {
      throw new Error('Project has no organization');
    }

    // Add user to the organization
    return await addUserToTeam(project.organization_id, userId, role);
  } catch (err) {
    console.error('addUserToProject error', err);
    throw err;
  }
}

/**
 * Return the list of projects that a user is a member of through organization membership.
 */
export async function getUserProjects(userId: string) {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        organization:organizations!inner(
          organization_members!inner(user_id)
        )
      `)
      .eq('organization.organization_members.user_id', userId)
      .eq('organization.organization_members.is_active', true);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getUserProjects error', err);
    throw err;
  }
}

/**
 * Return organization members as team members with user details.
 */
export async function getTeamMembers(organizationId: string) {
  try {
    const { data: members, error: membersErr } = await supabase
      .from('organization_members')
      .select(`
        *,
        profiles:user_id(id, email, full_name, display_name)
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (membersErr) throw membersErr;
    if (!members || members.length === 0) return [];

    // Format the data to match expected structure
    const formatted = members.map((member: any) => ({
      id: member.id,
      team_id: member.organization_id,
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      user: member.profiles ? {
        id: member.profiles.id,
        email: member.profiles.email,
        full_name: member.profiles.full_name,
        display_name: member.profiles.display_name || member.profiles.full_name
      } : null,
    }));

    return formatted;
  } catch (err) {
    console.error('getTeamMembers error', err);
    throw err;
  }
}
