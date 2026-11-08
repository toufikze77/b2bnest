// HMRC P7b: account deletion and company closure. Two steps each:
//   action 'check' : what would happen, or why it can't (read-only, no confirmation needed);
//   action 'delete' / 'close': needs the "I have downloaded what I need" tick, the typed email (or company name), a
//   fresh sign-in in the last 10 minutes (authenticator code for people who use one), and a request slot (rate limit +
//   audit row). The SQL function repeats every refusal inside its own transaction (docs/hmrc-p7b/proposal.sql).
// No Stripe call is made: a live subscription must be cancelled in the billing portal first.
import { done, type DrDeps, type DrResult, fail, finish, isFresh, isMissing, isUuid, MESSAGES, removeFiles, takeSlot, whoIsAsking } from './core.ts';
import { ACCOUNT_BUCKETS, COMPANY_BUCKETS } from './tables.ts';

export const DESTRUCTIVE_PER_HOUR = 5;

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const names = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : '');

function refusal(j: Record<string, unknown>): DrResult {
  const reasons = Array.isArray(j.reasons) ? j.reasons.filter((r): r is string => typeof r === 'string') : [];
  const messages = reasons.map((r) => (MESSAGES[r] ?? MESSAGES.server_error)
    .replace('{names}', r === 'last_owner' ? names(j.last_owner_of) : names(j.pays_for)));
  return { status: 409, body: { ok: false, code: 'refused', reasons, messages, message: messages.join(' ') } };
}

export async function accountDelete(req: { authHeader: string | null; body: Record<string, unknown> }, deps: DrDeps): Promise<DrResult> {
  const who = await whoIsAsking(req.authHeader, deps);
  if ('status' in who) return who;
  const action = req.body.action;
  if (action !== 'check' && action !== 'delete') return fail(400, 'bad_request');

  if (action === 'check') {
    const r = await deps.rpc('data_rights_delete_account', { p_user: who.userId, p_request: null, p_check_only: true });
    if (isMissing(r.error)) return fail(503, 'not_available');
    if (r.error || !r.data || typeof r.data !== 'object') return fail(500, 'server_error');
    const j = r.data as Record<string, unknown>;
    if (j.result === 'refused') return refusal(j);
    if (j.result === 'demo') return fail(403, 'demo_readonly');
    if (j.result !== 'ok') return fail(500, 'server_error');
    return done({ companies_closed: j.companies_closed ?? [], companies_left: j.companies_left ?? [], confirm_with: who.usesTotp ? 'authenticator' : 'sign_in' });
  }

  if (req.body.downloaded !== true) return fail(400, 'confirm_download');
  if (!who.email || norm(req.body.email) !== norm(who.email)) return fail(400, 'email_mismatch');
  if (!isFresh(who, deps.now())) return fail(401, 'reauth_required', { confirm_with: who.usesTotp ? 'authenticator' : 'sign_in' });
  const slot = await takeSlot(deps, who.userId, null, 'account_delete', DESTRUCTIVE_PER_HOUR);
  if (typeof slot !== 'string') return slot;

  const r = await deps.rpc('data_rights_delete_account', { p_user: who.userId, p_request: slot, p_check_only: false });
  if (r.error || !r.data || typeof r.data !== 'object') {
    await finish(deps, slot, 'failed', isMissing(r.error) ? 'not_available' : 'server_error');
    return isMissing(r.error) ? fail(503, 'not_available') : fail(500, 'server_error');
  }
  const j = r.data as Record<string, unknown>;
  if (j.result === 'refused') { await finish(deps, slot, 'refused', String((j.reasons as string[] | undefined)?.[0] ?? 'refused')); return refusal(j); }
  if (j.result !== 'deleted') { await finish(deps, slot, 'failed', String(j.result ?? 'unknown')); return fail(500, 'server_error'); }

  // The account is gone (one transaction). Now the uploaded files: personal pictures, and closed companies' attachments.
  let filesOk = await removeFiles(deps, ACCOUNT_BUCKETS, who.userId);
  for (const id of Array.isArray(j.closed_ids) ? j.closed_ids.filter(isUuid) : []) filesOk = (await removeFiles(deps, COMPANY_BUCKETS, id)) && filesOk;
  deps.log('account_deleted', { companies_closed: j.companies_closed ?? 0, files_ok: filesOk });
  return done({
    deleted: true, companies_closed: j.companies_closed ?? 0, files_removed: filesOk,
    message: 'Your account is deleted. If you needed your records, you should have downloaded them first.'
      + (filesOk ? '' : ' Some uploaded files could not be removed automatically; we will remove them. Questions: info@b2bnest.online.'),
  });
}

export async function companyClose(req: { authHeader: string | null; body: Record<string, unknown> }, deps: DrDeps): Promise<DrResult> {
  const who = await whoIsAsking(req.authHeader, deps);
  if ('status' in who) return who;
  const action = req.body.action;
  const company = req.body.company_id;
  if ((action !== 'check' && action !== 'close') || !isUuid(company)) return fail(400, 'bad_request');

  const c = await deps.rpc('data_rights_close_company', { p_company: company, p_user: who.userId, p_request: null, p_check_only: true });
  if (isMissing(c.error)) return fail(503, 'not_available');
  if (c.error || !c.data || typeof c.data !== 'object') return fail(500, 'server_error');
  const info = c.data as Record<string, unknown>;
  if (info.result === 'not_owner') return fail(403, 'not_owner');
  if (info.result === 'already_closed') return fail(409, 'already_closed');
  if (info.result === 'demo') return fail(403, 'demo_readonly');
  if (info.result !== 'ok') return fail(500, 'server_error');
  if (action === 'check') {
    return done({ name: info.name, members: info.members, hmrc_connected: info.hmrc_connected, hmrc_submissions: info.hmrc_submissions,
      confirm_with: who.usesTotp ? 'authenticator' : 'sign_in' });
  }

  if (req.body.downloaded !== true) return fail(400, 'confirm_download');
  if (norm(req.body.name) === '' || norm(req.body.name) !== norm(info.name)) return fail(400, 'name_mismatch');
  if (!isFresh(who, deps.now())) return fail(401, 'reauth_required', { confirm_with: who.usesTotp ? 'authenticator' : 'sign_in' });
  const slot = await takeSlot(deps, who.userId, company, 'company_close', DESTRUCTIVE_PER_HOUR);
  if (typeof slot !== 'string') return slot;

  const r = await deps.rpc('data_rights_close_company', { p_company: company, p_user: who.userId, p_request: slot, p_check_only: false });
  const j = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>;
  if (r.error || j.result !== 'closed') {
    await finish(deps, slot, j.result === 'not_owner' || j.result === 'already_closed' ? 'refused' : 'failed', String(j.result ?? 'server_error'));
    if (j.result === 'not_owner') return fail(403, 'not_owner');
    if (j.result === 'already_closed') return fail(409, 'already_closed');
    return fail(500, 'server_error');
  }
  const filesOk = await removeFiles(deps, COMPANY_BUCKETS, company);
  deps.log('company_closed', { files_ok: filesOk });
  return done({
    closed: true, files_removed: filesOk,
    message: 'The company is closed. Its records, members and HMRC connection are removed; B2BNEST keeps its minimal HMRC record for 6 years.'
      + (filesOk ? '' : ' Some attachments could not be removed automatically; we will remove them.'),
  });
}
