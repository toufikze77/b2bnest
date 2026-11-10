// HMRC P7b: "Download my data" (scope account) and "Download company data" (scope company, owners and admins).
// Both need a fresh sign-in in the last 10 minutes (authenticator code for people who use one), like deletion.
// Account rows are read with the person's own sign-in (RLS) wherever a browser read policy exists; company rows with the
// service role after the owner/admin check, always filtered by that one company. Sensitive columns never leave
// (tables.ts SENSITIVE_COLUMN). Files are listed with links valid for 1 hour; their bytes are not copied.
// Exports work on every plan and after a trial ends: people must always be able to take their data with them.
import { toCsv } from './csv.ts';
import { type DrDeps, type DrResult, fail, finish, isFresh, isMissing, isUuid, takeSlot, whoIsAsking } from './core.ts';
import {
  ACCOUNT_BUCKETS, ACCOUNT_TABLES, COMPANY_BUCKETS, COMPANY_CHILD_TABLES, COMPANY_TABLES, NOT_EXPORTED, redact, SIGNED_URL_SECONDS,
} from './tables.ts';
import { zipStore, type ZipEntry } from './zip.ts';

export const PAGE = 1000;
export const MAX_ROWS_PER_TABLE = 20_000;
export const MAX_ZIP_BYTES = 40 * 1024 * 1024;
export const EXPORTS_PER_HOUR = 3;

type Note = { rows: number; left_out?: string[]; note?: string };

async function readAll(deps: DrDeps, as: 'caller' | 'service', jwt: string, table: string, select: string,
  filter: Parameters<DrDeps['read']>[4]): Promise<{ rows: Record<string, unknown>[]; note?: string }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE) {
    const r = await deps.read(as, jwt, table, select, filter, from, from + PAGE - 1);
    if (isMissing(r.error)) return { rows: [], note: 'not available in this version of B2BNEST' };
    if (r.error) return { rows, note: "couldn't be read; email info@b2bnest.online for a copy" };
    rows.push(...r.rows);
    if (r.rows.length < PAGE) return { rows };
  }
  return { rows, note: `only the first ${MAX_ROWS_PER_TABLE} rows; email info@b2bnest.online for the rest` };
}

function readme(scope: 'account' | 'company', when: Date, notes: Record<string, Note>, companyName: string | null): string {
  const lines = [
    scope === 'account' ? 'B2BNEST: your personal data' : `B2BNEST: company data for ${companyName ?? 'your company'}`,
    `Made on ${when.toISOString()}.`,
    '',
    'What is in this file',
    '--------------------',
    scope === 'account'
      ? 'One JSON file per table under account/, with only the rows about you. Records that belong to a company (for example invoices tagged to a company) are in that company\'s download, which an owner or admin can make.'
      : 'One JSON file per table under company/, with this company\'s rows only. invoices.csv, expenses.csv, bills.csv, vat_submissions.csv and journal_lines.csv (when present) are the same data for spreadsheets. vat_submissions holds the nine boxes exactly as sent to HMRC and HMRC\'s receipt. journal_entries and journal_lines are your bookkeeping ledger.',
    'files.json lists your uploaded files with a download link for each. The links stop working 1 hour after this file was made: download the files you need straight away, or make a new export later.',
    'manifest.json lists every table with how many rows it holds.',
    '',
    'Tables',
    '------',
    ...Object.entries(notes).map(([t, n]) => `${t}: ${n.rows} row(s)${n.note ? ` (${n.note})` : ''}${n.left_out?.length ? `; left out: ${n.left_out.join(', ')}` : ''}`),
    '',
    'What is not included, and why',
    '------------------------------',
    '- Passwords, two-step sign-in secrets and codes, access and refresh tokens, API keys and other secrets: never exported, for your security. Where a table holds such a column, the column is left out (listed above).',
    '- Payment provider references (Stripe customer and subscription ids): left out; your invoices and receipts are in the billing portal (Settings, Billing).',
    '- Other people\'s personal data: ' + (scope === 'account' ? 'only rows about you are included.' : 'other members appear only by their B2BNEST id and role; their own personal data is in their own download.'),
    '- Other companies\' data: never.',
    ...Object.entries(NOT_EXPORTED).map(([t, why]) => `- ${t}: ${why}`),
    '',
    'Keeping your records',
    '--------------------',
    'If you run a VAT-registered business, HMRC expects you to keep your VAT records (including what was sent to HMRC) for 6 years. Keep this download somewhere safe before you delete your account or close the company.',
    '',
    'Questions: info@b2bnest.online',
    '',
  ];
  return lines.join('\r\n');
}

export async function dataExport(req: { authHeader: string | null; body: Record<string, unknown> }, deps: DrDeps): Promise<DrResult> {
  const who = await whoIsAsking(req.authHeader, deps);
  if ('status' in who) return who;
  const scope = req.body.scope;
  if (scope !== 'account' && scope !== 'company') return fail(400, 'bad_request');
  const company = scope === 'company' ? req.body.company_id : null;
  if (scope === 'company' && !isUuid(company)) return fail(400, 'bad_request');

  let companyName: string | null = null;
  if (scope === 'company') {
    const r = await deps.rpc('data_rights_company_role', { p_company: company, p_user: who.userId });
    if (isMissing(r.error)) return fail(503, 'not_available');
    if (r.error) return fail(500, 'server_error');
    if (r.data === 'closed') return fail(403, 'company_closed');
    if (r.data !== 'owner' && r.data !== 'admin') return fail(403, 'not_admin');
  }
  // A download of everything is sensitive too (an unlocked computer): the same fresh sign-in as for deletion, checked
  // before a request slot is taken or anything is read. Audited in the function log (no slot, so no request row).
  if (!isFresh(who, deps.now())) {
    deps.log('export_refused', { scope, reason: 'reauth_required' });
    return fail(401, 'reauth_required', { confirm_with: who.usesTotp ? 'authenticator' : 'sign_in' });
  }
  const slot = await takeSlot(deps, who.userId, company as string | null, scope === 'account' ? 'export_account' : 'export_company', EXPORTS_PER_HOUR);
  if (typeof slot !== 'string') return slot;

  try {
    const now = deps.now();
    const files: ZipEntry[] = [];
    const notes: Record<string, Note> = {};
    const kept: Record<string, Record<string, unknown>[]> = {};
    const add = (dir: string, table: string, raw: Record<string, unknown>[], omit: string[] | undefined, note?: string) => {
      const left = new Set<string>();
      const rows = raw.map((r) => { const x = redact(r, omit); x.left.forEach((c) => left.add(c)); return x.row; });
      kept[table] = rows;
      notes[table] = { rows: rows.length, ...(left.size ? { left_out: [...left].sort() } : {}), ...(note ? { note } : {}) };
      files.push({ name: `${dir}/${table}.json`, data: JSON.stringify(rows, null, 2) });
    };

    if (scope === 'account') {
      for (const t of ACCOUNT_TABLES) {
        const filter = { eq: [[t.by, who.userId]] as [string, string][], isNull: t.personalOnly ? [t.personalOnly] : [] };
        const r = await readAll(deps, t.via, who.jwt, t.table, '*', filter);
        add('account', t.table, r.rows, t.omit, r.note);
      }
    } else {
      for (const t of COMPANY_TABLES) {
        const r = await readAll(deps, 'service', who.jwt, t.table, t.select ?? '*', { eq: [[t.by, company as string]] });
        add('company', t.table, r.rows, t.omit, r.note);
        if (t.table === 'organizations') companyName = typeof r.rows[0]?.name === 'string' ? r.rows[0].name as string : null;
      }
      for (const c of COMPANY_CHILD_TABLES) {
        const ids = (kept[c.parent] ?? []).map((r) => r.id).filter((id): id is string | number => typeof id === 'string' || typeof id === 'number').map(String);
        const rows: Record<string, unknown>[] = [];
        let note: string | undefined;
        for (let i = 0; i < ids.length && !note; i += 200) {
          const r = await readAll(deps, 'service', who.jwt, c.table, '*', { eq: [], inList: [c.fk, ids.slice(i, i + 200)] });
          rows.push(...r.rows);
          note = r.note;
        }
        add('company', c.table, rows, c.omit, note);
      }
      for (const [t, name] of [['invoices', 'invoices'], ['expenses', 'expenses'], ['bills', 'bills'], ['hmrc_vat_submissions', 'vat_submissions'], ['journal_lines', 'journal_lines']] as const) {
        if (kept[t]?.length) files.push({ name: `company/${name}.csv`, data: toCsv(kept[t]) });
      }
    }

    const links: { bucket: string; path: string; url: string | null; expires_at: string }[] = [];
    const expires = new Date(now.getTime() + SIGNED_URL_SECONDS * 1000).toISOString();
    for (const b of scope === 'account' ? ACCOUNT_BUCKETS : COMPANY_BUCKETS) {
      const paths = await deps.storageList(b, scope === 'account' ? who.userId : company as string).catch(() => [] as string[]);
      for (const p of paths) links.push({ bucket: b, path: p, url: await deps.storageSign(b, p, SIGNED_URL_SECONDS).catch(() => null), expires_at: expires });
    }
    files.push({ name: 'files.json', data: JSON.stringify(links, null, 2) });
    files.push({ name: 'manifest.json', data: JSON.stringify({ scope, made_at: now.toISOString(), tables: notes, files: links.length }, null, 2) });
    files.unshift({ name: 'README.txt', data: readme(scope, now, notes, companyName) });

    const bytes = zipStore(files, now);
    if (bytes.length > MAX_ZIP_BYTES) {
      await finish(deps, slot, 'failed', 'too_large');
      return fail(413, 'too_large');
    }
    const partial = Object.values(notes).some((n) => n.note && !n.note.startsWith('not available'));
    await finish(deps, slot, 'done', partial ? 'export_partial' : 'export_ready');
    deps.log('export_ready', { scope, tables: Object.keys(notes).length, files: links.length, partial });
    const day = now.toISOString().slice(0, 10);
    return { status: 200, bytes, filename: scope === 'account' ? `b2bnest-my-data-${day}.zip` : `b2bnest-company-data-${day}.zip` };
  } catch (e) {
    deps.log('export_failed', { error: e instanceof Error ? e.name : 'unknown' });
    await finish(deps, slot, 'failed', 'server_error');
    return fail(500, 'server_error');
  }
}

