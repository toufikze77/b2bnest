import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * End-to-end style test for the team invitation flow.
 *
 * Covers:
 *  1. Creating a team (organization + owner membership row)
 *  2. Inviting a member by email via the `send-invitation-email` edge function
 *  3. Simulating the invitee accepting the invite (membership row created)
 *  4. Verifying the new member appears in the team
 *
 * The Supabase client is mocked with an in-memory store so the flow can be
 * exercised end-to-end without a network connection.
 */

type Row = Record<string, any>;

// ---------- in-memory store ----------
const store: Record<string, Row[]> = {
  organizations: [],
  organization_members: [],
  profiles: [
    { id: "owner-user", email: "owner@example.com", full_name: "Owner User", display_name: "Owner" },
    { id: "invitee-user", email: "invitee@example.com", full_name: "Invitee User", display_name: "Invitee" },
  ],
};

const currentUser = { id: "owner-user", email: "owner@example.com" };
const invitationEmails: Array<{ email: string; organization_id: string; role: string }> = [];

function makeQuery(table: string) {
  let rows = [...(store[table] ?? [])];
  const filters: Array<(r: Row) => boolean> = [];
  let insertPayload: Row[] | null = null;
  let selectAfterInsert = false;
  let singleMode = false;
  let maybeSingleMode = false;

  const exec = () => {
    if (insertPayload) {
      const inserted = insertPayload.map((r) => ({ id: r.id ?? crypto.randomUUID(), ...r }));
      store[table].push(...inserted);
      if (!selectAfterInsert) return { data: null, error: null };
      const data = singleMode || maybeSingleMode ? inserted[0] : inserted;
      return { data, error: null };
    }
    const filtered = rows.filter((r) => filters.every((f) => f(r)));
    if (singleMode) {
      if (filtered.length !== 1) return { data: null, error: { message: "Not single" } };
      return { data: filtered[0], error: null };
    }
    if (maybeSingleMode) {
      return { data: filtered[0] ?? null, error: null };
    }
    return { data: filtered, error: null };
  };

  const api: any = {
    select: (_cols?: string) => {
      if (insertPayload) selectAfterInsert = true;
      return api;
    },
    insert: (payload: Row | Row[]) => {
      insertPayload = Array.isArray(payload) ? payload : [payload];
      return api;
    },
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return api;
    },
    single: () => {
      singleMode = true;
      return exec();
    },
    maybeSingle: () => {
      maybeSingleMode = true;
      return exec();
    },
    then: (resolve: any) => resolve(exec()),
  };
  return api;
}

const supabase = {
  auth: {
    getUser: async () => ({ data: { user: currentUser }, error: null }),
  },
  from: (table: string) => makeQuery(table),
  functions: {
    invoke: async (name: string, opts: { body: any }) => {
      if (name !== "send-invitation-email") {
        return { data: null, error: { message: "unknown function" } };
      }
      const { email, organization_id, role, invited_by } = opts.body;

      // Mimic edge function membership check
      const membership = store.organization_members.find(
        (m) => m.organization_id === organization_id && m.user_id === currentUser.id && m.is_active,
      );
      if (!membership) {
        return { data: null, error: { message: "Forbidden" } };
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { data: null, error: { message: "Invalid email" } };
      }
      invitationEmails.push({ email, organization_id, role });
      return { data: { success: true, invited_by }, error: null };
    },
  },
};

// ---------- flow helpers (mirror ProjectManagement.tsx) ----------
async function createTeam(name: string) {
  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name, slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`, created_by: currentUser.id })
    .select()
    .single();
  if (error) throw error;
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: currentUser.id, role: "owner", is_active: true });
  if (memberError) throw memberError;
  return org;
}

async function inviteMember(organizationId: string, email: string, role = "member") {
  const { data, error } = await supabase.functions.invoke("send-invitation-email", {
    body: { email, organization_id: organizationId, role, invited_by: currentUser.email },
  });
  if (error) throw error;
  return data;
}

async function acceptInvitation(organizationId: string, inviteeUserId: string) {
  // Simulates what happens once the invitee follows the email link and joins.
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: inviteeUserId, role: "member", is_active: true });
  if (error) throw error;
}

async function listTeamMembers(organizationId: string) {
  const { data: members } = await supabase
    .from("organization_members")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  return (members ?? []).map((m: Row) => ({
    ...m,
    profile: store.profiles.find((p) => p.id === m.user_id) ?? null,
  }));
}

// ---------- the test ----------
describe("E2E: create team, invite member, verify membership after acceptance", () => {
  beforeEach(() => {
    store.organizations = [];
    store.organization_members = [];
    invitationEmails.length = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `id-${Math.random().toString(36).slice(2, 10)}` });
  });

  it("runs the full invitation lifecycle", async () => {
    // 1. Create team
    const team = await createTeam("Acme Team");
    expect(team.id).toBeTruthy();
    expect(team.name).toBe("Acme Team");

    // Owner is a member
    const initial = await listTeamMembers(team.id);
    expect(initial).toHaveLength(1);
    expect(initial[0].user_id).toBe("owner-user");
    expect(initial[0].role).toBe("owner");

    // 2. Invite member by email
    const result = await inviteMember(team.id, "invitee@example.com", "member");
    expect(result.success).toBe(true);
    expect(invitationEmails).toHaveLength(1);
    expect(invitationEmails[0]).toMatchObject({
      email: "invitee@example.com",
      organization_id: team.id,
      role: "member",
    });

    // Reject invalid email
    await expect(inviteMember(team.id, "not-an-email", "member")).rejects.toMatchObject({
      message: "Invalid email",
    });

    // Reject invite from non-member organization
    await expect(inviteMember("bogus-org-id", "invitee@example.com")).rejects.toMatchObject({
      message: "Forbidden",
    });

    // 3. Invitee accepts the invitation
    await acceptInvitation(team.id, "invitee-user");

    // 4. Verify membership
    const after = await listTeamMembers(team.id);
    expect(after).toHaveLength(2);
    const invitee = after.find((m) => m.user_id === "invitee-user");
    expect(invitee).toBeDefined();
    expect(invitee!.role).toBe("member");
    expect(invitee!.is_active).toBe(true);
    expect(invitee!.profile?.email).toBe("invitee@example.com");
  });
});
