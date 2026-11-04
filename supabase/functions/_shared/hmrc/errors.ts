// HMRC P0: what the browser is told. Codes the UI understands, in plain UK English, never a token, code, secret or HMRC
// response body.
export type HmrcErrorCode =
  | 'not_configured' | 'unauthorized' | 'two_step_required' | 'not_member' | 'not_admin' | 'trial_ended' | 'suspended' | 'plan_not_included'
  | 'bad_request' | 'bad_state' | 'hmrc_refused' | 'hmrc_unavailable' | 'not_connected' | 'needs_reconnect' | 'server_error';

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
};
export const HMRC_STATUS: Record<HmrcErrorCode, number> = {
  not_configured: 503, unauthorized: 401, two_step_required: 403, not_member: 403, not_admin: 403, trial_ended: 403, suspended: 403, plan_not_included: 403,
  bad_request: 400, bad_state: 400, hmrc_refused: 502, hmrc_unavailable: 502, not_connected: 409, needs_reconnect: 409, server_error: 500,
};
export type HandlerResult = { status: number; body: Record<string, unknown> };
export const fail = (code: HmrcErrorCode): HandlerResult => ({ status: HMRC_STATUS[code], body: { ok: false, code, message: HMRC_MESSAGES[code] } });
export const done = (body: Record<string, unknown>): HandlerResult => ({ status: 200, body: { ok: true, ...body } });
