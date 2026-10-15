import { supabase } from '@/integrations/supabase/client';
import type { StaffInvitation, EmailStatus } from '@/lib/onboarding';

// RPCs/tables come from docs/onboarding-2026-10-15/proposal.sql, which is NOT applied yet; absent from generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export class NotInstalledError extends Error {
  constructor() { super('Inviting colleagues needs an approved database update that is not installed yet.'); }
}
const fail = (e: { code?: string; message?: string }): Error =>
  e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42883' || e.code === '42703' || /does not exist|schema cache/i.test(e.message || '')
    ? new NotInstalledError() : new Error(e.message || 'Something went wrong. Please try again.');
async function run<T>(p: PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> {
  const { data, error } = await p; if (error) throw fail(error); return data;
}

export const listStaffInvitations = (org: string) => run<StaffInvitation[]>(
  db.from('organization_invitations').select('id,email,role,expires_at,accepted_at,revoked_at').eq('organization_id', org).order('created_at', { ascending: false }));
export const inviteMember = async (org: string, email: string, role: string) => {
  const rows = await run<{ invitation_id: string | null; token: string | null; outcome: 'created' | 'already_pending' | 'already_member' }[]>(
    db.rpc('org_invite_member', { _org: org, _email: email, _role: role }));
  return rows[0];
};
export const invitationToken = (id: string) => run<string>(db.rpc('org_invitation_token', { _invitation: id }));
export const manageInvitation = (id: string, action: 'revoke' | 'extend') => run(db.rpc('org_manage_invitation', { _invitation: id, _action: action }));
export const seatSummary = async (org: string) =>
  (await run<{ used: number; pending: number; seat_limit: number | null }[]>(db.rpc('org_seat_summary', { _org: org })))[0];
export const emailStatuses = (org: string) => run<{ invitation_id: string; kind: string; status: EmailStatus }[]>(db.rpc('onboarding_email_status', { _org: org }));
export const previewInvitation = async (token: string) =>
  (await run<{ company: string | null; role: string | null; masked_email: string | null; state: string; email_matches: boolean }[]>(
    db.rpc('org_invitation_preview', { _token: token })))[0];
export const acceptInvitation = (token: string) => run<string>(db.rpc('org_accept_invitation', { _token: token }));

export const getEmailPref = async (org: string, uid: string) =>
  (await run<{ email_enabled: boolean } | null>(db.from('support_notification_prefs').select('email_enabled').eq('organization_id', org).eq('user_id', uid).maybeSingle()))?.email_enabled ?? true;
export const setEmailPref = (org: string, uid: string, enabled: boolean) =>
  run(db.from('support_notification_prefs').upsert({ organization_id: org, user_id: uid, email_enabled: enabled, updated_at: new Date().toISOString() }).select('user_id'));
export const submitFeedback = (ticket: string, rating: number, comment: string) => run(db.rpc('support_submit_feedback', { _ticket: ticket, _rating: rating, _comment: comment }));
export const feedbackSubmitted = (ticket: string) => run<boolean>(db.rpc('support_feedback_submitted', { _ticket: ticket }));

/** Sending stays off until the owner approves; the UI must never imply an email went out. */
export const EMAIL_SENDING_ENABLED = false;
