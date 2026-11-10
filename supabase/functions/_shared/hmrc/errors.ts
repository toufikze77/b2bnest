// HMRC P0: what the browser is told. Codes the UI understands, in plain UK English, never a token, code, secret or HMRC
// response body.
export type HmrcErrorCode =
  | 'not_configured' | 'unauthorized' | 'two_step_required' | 'not_member' | 'not_admin' | 'trial_ended' | 'suspended' | 'plan_not_included'
  | 'bad_request' | 'bad_state' | 'hmrc_refused' | 'hmrc_unavailable' | 'not_connected' | 'needs_reconnect' | 'server_error'
  | 'test_limit' | 'hmrc_busy' | 'scope_missing'
  | 'vrn_missing' | 'obligations_limit' | 'vrn_invalid' | 'vat_not_authorised' | 'vat_insolvent'
  // HMRC P8: reading what HMRC holds.
  | 'not_available' | 'read_limit' | 'not_submitted' | 'return_not_found' | 'dates_invalid'
  // HMRC hide switch (docs/hmrc-hide/README.md).
  | 'hmrc_unavailable_for_now';

export const HMRC_MESSAGES: Record<HmrcErrorCode, string> = {
  not_configured: "HMRC connection isn't set up yet.",
  unauthorized: 'Please sign in again.',
  two_step_required: 'Two-step sign-in is on for your account. Sign out, sign in again with your 6-digit code, then try again.',
  not_member: "You don't have access to this company's HMRC connection.",
  not_admin: 'Only an owner or admin of this company can connect or disconnect HMRC.',
  trial_ended: 'Your trial has ended. Choose a plan to use HMRC Integration.',
  suspended: 'Your account is suspended.',
  plan_not_included: 'HMRC tools are included in the Business and Scale plans.',
  bad_request: 'Something was missing from the request. Please try again.',
  bad_state: 'This HMRC sign-in has expired or was already used. Start again from the HMRC page.',
  hmrc_refused: "HMRC didn't accept the sign-in. Please try connecting again.",
  hmrc_unavailable: "HMRC couldn't be reached. Please try again later.",
  not_connected: 'This company is not connected to HMRC.',
  needs_reconnect: 'The HMRC connection has expired. An owner or admin needs to connect again.',
  server_error: 'Something went wrong. Please try again.',
  test_limit: 'You can run 10 HMRC tests an hour for this company. Please try again later.',
  hmrc_busy: 'HMRC is busy right now. Please try again in a minute.',
  scope_missing: 'Connect to HMRC again to run this test: the test needs one more permission from HMRC (test environment only).',
  // HMRC P3: reading VAT obligations.
  vrn_missing: 'Add your VAT number in Settings → HMRC first.',
  obligations_limit: 'You can get VAT obligations 10 times an hour for this company. Please try again later.',
  vrn_invalid: "HMRC didn't accept this VAT number. Check it in Settings → HMRC.",
  vat_not_authorised: "HMRC says this HMRC sign-in can't see VAT for this VAT number. Check the VAT number, or connect again with the HMRC account that owns it.",
  vat_insolvent: "HMRC can't show VAT obligations for this business through this service.",
  // HMRC P8 (docs/hmrc-p8/README.md).
  not_available: "This isn't available yet.",
  read_limit: 'You can do this 10 times an hour for this company. Please try again later.',
  not_submitted: "There's no accepted return for this period sent through B2BNEST, so there's nothing to compare.",
  return_not_found: 'HMRC has no return for this period.',
  dates_invalid: "HMRC didn't accept these dates. Choose dates up to today, at most 365 days apart.",
  hmrc_unavailable_for_now: "HMRC filing isn't available yet.",
};
export const HMRC_STATUS: Record<HmrcErrorCode, number> = {
  not_configured: 503, unauthorized: 401, two_step_required: 403, not_member: 403, not_admin: 403, trial_ended: 403, suspended: 403, plan_not_included: 403,
  bad_request: 400, bad_state: 400, hmrc_refused: 502, hmrc_unavailable: 502, not_connected: 409, needs_reconnect: 409, server_error: 500, test_limit: 429, hmrc_busy: 503, scope_missing: 409,
  vrn_missing: 409, obligations_limit: 429, vrn_invalid: 422, vat_not_authorised: 403, vat_insolvent: 422,
  not_available: 503, read_limit: 429, not_submitted: 409, return_not_found: 409, dates_invalid: 400,
  hmrc_unavailable_for_now: 403,
};
export type HandlerResult = { status: number; body: Record<string, unknown> };
export const fail = (code: HmrcErrorCode): HandlerResult => ({ status: HMRC_STATUS[code], body: { ok: false, code, message: HMRC_MESSAGES[code] } });
/** HMRC P7a: "busy" with HMRC's Retry-After, when it sent one (the person retries; nothing retries on its own). */
export const busy = (retryAfter?: number): HandlerResult => {
  const r = fail('hmrc_busy');
  if (!retryAfter) return r;
  const wait = retryAfter < 120 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`;
  return { status: r.status, body: { ...r.body, retry_after: retryAfter, message: `HMRC is busy right now. Please try again in ${wait}.` } };
};
export const done = (body: Record<string, unknown>): HandlerResult => ({ status: 200, body: { ok: true, ...body } });
