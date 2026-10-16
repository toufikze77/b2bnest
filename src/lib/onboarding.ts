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

/** Shown wherever email would otherwise be implied, until a bounded delivery test is approved and sending is switched on. */
export const EMAIL_OFF_NOTICE = 'Email sending is switched off: nothing is emailed. Copy the link and send it yourself; updates appear in B2BNEST.';

export type SeatSummary = { used: number; pending: number; seat_limit: number | null; pooled_companies?: number | null; basis?: string | null };
/** Seats are one allowance per paying owner, shared by every company that owner bills for (unique staff counted once). */
export function seatSummaryText(s: SeatSummary): string {
  const scope = (s.pooled_companies ?? 1) > 1 ? ` across ${s.pooled_companies} companies on the same plan` : '';
  const counts = `${s.used} staff + ${s.pending} pending invitation${s.pending === 1 ? '' : 's'}${scope}`;
  if (s.basis === 'no_owner') return `Seats: ${counts}. This company has no active owner, so no plan limit can apply.`;
  return s.seat_limit !== null ? `Seats: ${counts} of ${s.seat_limit}. Support customers don't use seats.`
    : `Seats: ${counts} (no limit set on your plan). Support customers don't use seats.`;
}

/** Client-side mirror of the seat check (server decides). null limit = no limit configured. */
export const seatsFull = (used: number, pending: number, limit: number | null) => limit !== null && used + pending >= limit;

export const canSubmitFeedback = (status: string, feedbackEnabled: boolean, alreadySubmitted: boolean) =>
  feedbackEnabled && status === 'closed' && !alreadySubmitted;
