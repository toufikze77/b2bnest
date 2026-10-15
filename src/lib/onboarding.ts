/** Onboarding rules shared by Members & roles, the join page, sign-in and the support portal. Mirrors the database checks. */
export const INVITE_ROLES = ['admin', 'manager', 'member'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Owners may invite admin/manager/member; admins manager/member; nobody else. Never owner. */
export function invitableRoles(myRole: string | undefined): InviteRole[] {
  if (myRole === 'owner') return [...INVITE_ROLES];
  if (myRole === 'admin') return ['manager', 'member'];
  return [];
}

/** Only in-app paths we expect to return to after sign-in; anything else goes home (no open redirects). */
const NEXT_ALLOWED = ['/join', '/support/portal', '/support-desk', '/settings'];
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  const path = raw.split(/[?#]/)[0];
  return NEXT_ALLOWED.some((p) => path === p || path.startsWith(p + '/')) ? raw : '/';
}
export const authUrlWithNext = (next: string) => `/auth?next=${encodeURIComponent(safeNext(next))}`;

export const staffInviteLink = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/join?token=${encodeURIComponent(token)}`;
export const customerPortalLink = (origin: string, orgId: string) => `${origin.replace(/\/$/, '')}/support/portal?org=${encodeURIComponent(orgId)}`;

export type EmailStatus = 'pending' | 'sending' | 'accepted_by_provider' | 'failed' | 'uncertain' | 'cancelled';
/** Wording never implies delivery: the provider accepting a message is not inbox delivery. */
export function emailStatusLabel(s: EmailStatus | null | undefined, sendingEnabled: boolean): string {
  if (!s || (!sendingEnabled && (s === 'pending' || s === 'failed'))) return 'Invitation saved — email not sent';
  return {
    pending: 'Email queued — not sent yet', sending: 'Email being handed to the mail provider', failed: 'Email failed — will retry',
    accepted_by_provider: 'Email accepted by mail provider (not proof of delivery)', uncertain: 'Email outcome unknown — not resent automatically',
    cancelled: 'Email cancelled',
  }[s];
}

export type StaffInvitation = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
export function staffInvitationState(i: StaffInvitation, now = Date.now()): 'Joined' | 'Revoked' | 'Expired' | 'Pending' {
  if (i.accepted_at) return 'Joined';
  if (i.revoked_at) return 'Revoked';
  return Date.parse(i.expires_at) <= now ? 'Expired' : 'Pending';
}

/** Client-side mirror of the seat check (server decides). null limit = no limit configured. */
export const seatsFull = (used: number, pending: number, limit: number | null) => limit !== null && used + pending >= limit;

export const canSubmitFeedback = (status: string, feedbackEnabled: boolean, alreadySubmitted: boolean) =>
  feedbackEnabled && status === 'closed' && !alreadySubmitted;
