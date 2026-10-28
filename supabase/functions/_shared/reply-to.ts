// Where replies to a workflow email go (Phase 18). Shared by workflow-send-email, which sets the Reply-To header,
// and the Workflow Studio preview (src/components/workflows/RunDialog.tsx), which shows it, so both always agree.
//
// The address is ONLY the signed-in sender's own account email, read server-side from the authenticated user, and
// only once they have verified it. It is never taken from the request body, so nobody can aim replies at someone else.
// B2BNEST stores no company contact email (checked in production, Phase 18), so there is no other source to prefer.

/** A plain addr-spec only: ASCII, no spaces, quotes, angle brackets, commas or CR/LF, so it is always one safe header line. */
const SAFE_EMAIL =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isSafeReplyAddress(s: unknown): s is string {
  return typeof s === "string" && s.length <= 254 && SAFE_EMAIL.test(s) && !s.startsWith(".") && !s.includes("..");
}

export interface ReplyUser { email?: string | null; email_confirmed_at?: string | null }

/** The sender's own verified email, or null (no email, not verified yet, or not a safe single address). */
export function replyToAddress(user: ReplyUser | null | undefined): string | null {
  if (!user?.email_confirmed_at) return null;
  // Used exactly as stored: anything that isn't already one safe address (even stray spaces) is refused, not repaired.
  return isSafeReplyAddress(user.email) ? user.email : null;
}

/** Shown, and returned by the server, when there is no reply address to set. */
export const NO_REPLY_ADDRESS =
  "Your account email address isn't verified, so replies will go to B2BNEST's sending address. Verify your email to have replies come to you.";
