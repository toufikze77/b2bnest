/**
 * Two-step sign-in is NOT enforced: signIn() checks only the password (see docs/phase11a/mfa-design.md for the real
 * design). Until that ships, every screen uses this wording and the switch to turn it on stays disabled.
 */
export const TWO_STEP_ENFORCED = false;

export const TWO_STEP_STATUS = 'Not active yet';
export const TWO_STEP_NOT_ACTIVE = 'Two-step sign-in is not active yet. Signing in needs only your password.';
export const TWO_STEP_COMING_SOON = "Coming soon: we'll tell you when it's available.";
/** For the accounts that switched the old setting on: it was saved but never checked at sign-in. */
export const TWO_STEP_OLD_SETTING = 'You turned this on earlier, but it was never checked when you signed in. Nothing else changes for you.';
