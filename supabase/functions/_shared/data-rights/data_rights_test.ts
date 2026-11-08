// HMRC P7b: data-export, account-delete and company-close (docs/hmrc-p7b/README.md). Fake dependencies only: no network.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { accountDelete, companyClose } from './closure.ts';
import type { DrDeps, ReadFilter } from './core.ts';
import { toCsv } from './csv.ts';
import { dataExport } from './export.ts';
import { ACCOUNT_TABLES, COMPANY_TABLES, redact, SENSITIVE_COLUMN } from './tables.ts';
import { unzipStore, zipStore } from './zip.ts';

const A = 'a0000000-0000-4000-8000-00000000000a'; // owner of X, uses an authenticator (TOTP)
const C = 'c0000000-0000-4000-8000-00000000000c'; // member of X, password only
const M = 'e6000000-0000-4000-8000-0000000000e6'; // demo account
const X = '0a000000-0000-4000-8000-000000000001';
const Y = '0b000000-0000-4000-8000-000000000001'; // another company: never in A's export
const NOW = new Date('2026-11-09T12:00:00Z');

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function jwt(sub: string, aal: 'aal1' | 'aal2', amr: [string, number][]) {
  return `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', aal, amr: amr.map(([method, at]) => ({ method, timestamp: Math.floor(at / 1000) })) })}.sig`;
}
const minsAgo = (m: number) => NOW.getTime() - m * 60_000;
const auth = (t: string) => `Bearer ${t}`;

interface World {
  users: Record<string, { id: string; email: string; totp: boolean }>;
  rows: Record<string, Record<string, unknown>[]>;
  missing: Set<string>;
  rpcs: { fn: string; args: Record<string, unknown> }[];
  rpc: Record<string, (args: Record<string, unknown>) => unknown>;
  reads: { as: string; table: string; select: string; filter: ReadFilter }[];
  files: Record<string, string[]>;
  removed: { bucket: string; paths: string[] }[];
  logs: string[];
}

function world(): World {
  return {
    users: {
      [jwt(A, 'aal2', [['password', minsAgo(60)], ['totp', minsAgo(2)]])]: { id: A, email: 'ann@example.test', totp: true },
      [jwt(A, 'aal1', [['password', minsAgo(1)]])]: { id: A, email: 'ann@example.test', totp: true },
      [jwt(A, 'aal2', [['password', minsAgo(90)], ['totp', minsAgo(30)]])]: { id: A, email: 'ann@example.test', totp: true },
      [jwt(C, 'aal1', [['password', minsAgo(3)]])]: { id: C, email: 'Cat@Example.test', totp: false },
      [jwt(C, 'aal1', [['password', minsAgo(45)]])]: { id: C, email: 'Cat@Example.test', totp: false },
      [jwt(M, 'aal1', [['password', minsAgo(1)]])]: { id: M, email: 'demo@example.test', totp: false },
    },
    rows: {
      profiles: [{ id: A, email: 'ann@example.test', full_name: 'Ann' }, { id: C, email: 'cat@example.test', full_name: 'Cat' }],
      notes: [{ id: 'n1', user_id: A, note: 'mine' }, { id: 'n2', user_id: C, note: 'not mine' }],
      invoices: [
        { id: 'i1', user_id: A, organization_id: null, invoice_number: 'A-PERSONAL' },
        { id: 'i2', user_id: A, organization_id: X, invoice_number: '=HYPERLINK("x")', total: 120 },
        { id: 'i3', user_id: C, organization_id: X, invoice_number: 'X-C' },
        { id: 'i4', user_id: 'someone', organization_id: Y, invoice_number: 'Y-SECRET-INVOICE' },
      ],
      user_integrations: [{ id: 'u1', user_id: A, provider: 'gmail', access_token: 'tok-plain', refresh_token: 'ref-plain', api_key: 'k' }],
      subscribers: [{ id: 's1', user_id: A, plan_key: 'business', stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' }],
      organizations: [{ id: X, name: 'Company X' }, { id: Y, name: 'Company Y' }],
      organization_members: [{ organization_id: X, user_id: A, role: 'owner', permissions: { all: true } }, { organization_id: X, user_id: C, role: 'member' },
        { organization_id: Y, user_id: 'someone', role: 'owner' }],
      hmrc_connections: [{ company_id: X, environment: 'sandbox', status: 'connected', access_token_enc: 'v1.x.y.z', refresh_token_enc: 'v1.x.y.z', scopes: ['read:vat'] }],
      hmrc_vat_submissions: [{ id: 's1', organization_id: X, period_key: '18A1', figures: { netVatDue: 145 }, figures_hash: 'a'.repeat(64), form_bundle_number: '1234' },
        { id: 's2', organization_id: Y, period_key: '18A1', figures: { netVatDue: 9 } }],
      hmrc_settings: [{ id: 'h1', user_id: A, organization_id: X, vat_number: 'GB123456789', client_id: 'cid', client_secret: 'shh' }],
      projects: [{ id: 'p1', user_id: A, organization_id: X, name: 'X project' }],
      project_members: [{ id: 'pm1', project_id: 'p1', user_id: C }, { id: 'pm2', project_id: 'p-other', user_id: 'someone' }],
    },
    missing: new Set(),
    rpcs: [],
    rpc: {
      data_rights_take_slot: () => [{ result: 'ok', request_id: 'f0000000-0000-4000-8000-000000000001' }],
      data_rights_finish: () => true,
      data_rights_company_role: ({ p_company, p_user }) => (p_company === X ? (p_user === A ? 'owner' : 'member') : 'not_member'),
      data_rights_delete_account: ({ p_check_only }) => (p_check_only ? { result: 'ok', companies_closed: [], companies_left: ['Company X'] }
        : { result: 'deleted', companies_closed: 1, closed_ids: ['0d000000-0000-4000-8000-000000000001'] }),
      data_rights_close_company: ({ p_user, p_check_only }) => (p_user !== A ? { result: 'not_owner' }
        : p_check_only ? { result: 'ok', name: 'Company X', members: 2, hmrc_connected: true, hmrc_submissions: 1 } : { result: 'closed', rows: 9 }),
    },
    reads: [],
    files: { 'user-avatars': [`${A}/1.png`, `${C}/2.png`], 'support-attachments': [`${X}/t1/a.pdf`, `${Y}/t9/b.pdf`] },
    removed: [],
    logs: [],
  };
}

function deps(w: World): DrDeps {
  return {
    now: () => NOW,
    log: (e, m) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
    getUser: async (t) => (w.users[t] ? { id: w.users[t].id, email: w.users[t].email } : null),
    listFactors: async (id) => (Object.values(w.users).find((u) => u.id === id)?.totp ? [{ factor_type: 'totp', status: 'verified' }] : []),
    isDemo: async (id) => id === M,
    rpc: async (fn, args) => {
      w.rpcs.push({ fn, args });
      if (w.missing.has(fn)) return { data: null, error: { code: 'PGRST202', message: 'not found' } };
      return { data: w.rpc[fn](args), error: null };
    },
    read: async (as, _jwt, table, select, filter, from, to) => {
      w.reads.push({ as, table, select, filter });
      if (w.missing.has(table)) return { rows: [], error: { code: 'PGRST205' } };
      let rows = (w.rows[table] ?? []).filter((r) => filter.eq.every(([k, v]) => r[k] === v) && (filter.isNull ?? []).every((k) => r[k] === null || r[k] === undefined)
        && (!filter.inList || filter.inList[1].includes(r[filter.inList[0]] as string)));
      if (select !== '*') rows = rows.map((r) => Object.fromEntries(select.split(',').map((c) => [c, r[c]])));
      return { rows: rows.slice(from, to + 1), error: null };
    },
    storageList: async (b, prefix) => (w.files[b] ?? []).filter((p) => p.startsWith(`${prefix}/`)),
    storageSign: async (b, p) => `https://storage.example.test/${b}/${p}?token=signed`,
    storageRemove: async (bucket, paths) => { w.removed.push({ bucket, paths }); return true; },
  };
}

const ATOTP = jwt(A, 'aal2', [['password', minsAgo(60)], ['totp', minsAgo(2)]]);
const AAAL1 = jwt(A, 'aal1', [['password', minsAgo(1)]]);
const ASTALE = jwt(A, 'aal2', [['password', minsAgo(90)], ['totp', minsAgo(30)]]);
const CFRESH = jwt(C, 'aal1', [['password', minsAgo(3)]]);
const CSTALE = jwt(C, 'aal1', [['password', minsAgo(45)]]);
const MDEMO = jwt(M, 'aal1', [['password', minsAgo(1)]]);
const text = (zip: Uint8Array) => { const m = unzipStore(zip); const d = new TextDecoder(); return new Map([...m].map(([k, v]) => [k, d.decode(v)])); };

Deno.test('zip: stored entries round-trip with correct CRCs; names are UTF-8', () => {
  const z = zipStore([{ name: 'README.txt', data: 'hello' }, { name: 'company/£.json', data: '[1]' }], NOW);
  const back = text(z);
  assertEquals(back.get('README.txt'), 'hello');
  assertEquals(back.get('company/£.json'), '[1]');
});

Deno.test('csv: a value that would run as a formula is neutralised; quotes and commas are quoted', () => {
  const csv = toCsv([{ a: '=SUM(A1)', b: 'x,"y"', c: null, d: { n: 1 } }]);
  assertStringIncludes(csv, "'=SUM(A1)");
  assertStringIncludes(csv, '"x,""y"""');
  assert(csv.startsWith('﻿a,b,c,d'));
});

Deno.test('redact: tokens, secrets, passwords, keys and Stripe ids never leave; ordinary columns stay', () => {
  for (const k of ['access_token', 'refresh_token', 'access_token_enc', 'client_secret', 'password', 'api_key', 'totp_secret', 'code', 'stripe_customer_id', 'webhook_secret', 'secret_key']) {
    assert(SENSITIVE_COLUMN.test(k), k);
  }
  for (const k of ['figures_hash', 'prompt_tokens', 'token_type', 'vat_number', 'invoice_number', 'country_code']) assert(!SENSITIVE_COLUMN.test(k), k);
  assertEquals(redact({ a: 1, password: 'x', client_id: 'c' }, ['client_id']), { row: { a: 1 }, left: ['password', 'client_id'] });
});

Deno.test('export: signed out, two-step not completed, demo and a bad scope are refused before anything is read', async () => {
  const w = world();
  assertEquals((await dataExport({ authHeader: null, body: { scope: 'account' } }, deps(w))).status, 401);
  assertEquals((await dataExport({ authHeader: auth(AAAL1), body: { scope: 'account' } }, deps(w))).body?.code, 'two_step_required');
  assertEquals((await dataExport({ authHeader: auth(MDEMO), body: { scope: 'account' } }, deps(w))).body?.code, 'demo_readonly');
  assertEquals((await dataExport({ authHeader: auth(CFRESH), body: { scope: 'everything' } }, deps(w))).status, 400);
  assertEquals(w.reads.length, 0);
  assertEquals(w.rpcs.length, 0);
});

Deno.test('export account: own rows only, read with the person\'s own sign-in where possible; no secrets; files as 1-hour links', async () => {
  const w = world();
  const r = await dataExport({ authHeader: auth(ATOTP), body: { scope: 'account' } }, deps(w));
  assertEquals(r.status, 200);
  assert(r.bytes && r.filename === 'b2bnest-my-data-2026-11-09.zip');
  const files = text(r.bytes!);
  for (const name of ['README.txt', 'account/profiles.json', 'account/notes.json', 'account/invoices.json', 'files.json', 'manifest.json']) assert(files.has(name), name);
  assertEquals(JSON.parse(files.get('account/notes.json')!), [{ id: 'n1', user_id: A, note: 'mine' }]);
  // Company invoices are in the company download; the personal one only here.
  assertEquals(JSON.parse(files.get('account/invoices.json')!).map((i: { invoice_number: string }) => i.invoice_number), ['A-PERSONAL']);
  assertEquals(JSON.parse(files.get('account/profiles.json')!).length, 1);
  const integ = JSON.parse(files.get('account/user_integrations.json')!);
  assertEquals(integ, [{ id: 'u1', user_id: A, provider: 'gmail' }]);
  assertEquals(JSON.parse(files.get('account/subscribers.json')!), [{ id: 's1', user_id: A, plan_key: 'business' }]);
  const all = [...files.values()].join('\n');
  for (const bad of ['tok-plain', 'ref-plain', 'cus_123', 'sub_123', 'shh', 'not mine', 'Y-SECRET-INVOICE', `${C}/2.png`]) assert(!all.includes(bad), bad);
  const links = JSON.parse(files.get('files.json')!);
  assertEquals(links.map((l: { path: string }) => l.path), [`${A}/1.png`]);
  assertEquals(links[0].expires_at, '2026-11-09T13:00:00.000Z');
  // Reads: caller JWT for tables with a browser policy, service role only where listed, always filtered by the person.
  for (const rd of w.reads) {
    const spec = ACCOUNT_TABLES.find((t) => t.table === rd.table)!;
    assertEquals(rd.as, spec.via, rd.table);
    assertEquals(rd.filter.eq, [[spec.by, A]], rd.table);
    if (spec.personalOnly) assertEquals(rd.filter.isNull, [spec.personalOnly]);
  }
  assertEquals(w.reads.find((x) => x.table === 'notes')?.as, 'caller');
  assertEquals(w.reads.find((x) => x.table === 'user_integrations')?.as, 'service');
  assertStringIncludes(files.get('README.txt')!, 'What is not included, and why');
  assertStringIncludes(files.get('README.txt')!, 'user_2fa_codes');
  // Audit row and rate limit.
  assertEquals(w.rpcs[0], { fn: 'data_rights_take_slot', args: { p_user: A, p_company: null, p_kind: 'export_account', p_limit: 3 } });
  assertEquals(w.rpcs.at(-1)?.args.p_status, 'done');
});

Deno.test('export company: owners and admins only; that company\'s rows only; HMRC connection without tokens; CSVs', async () => {
  const w = world();
  assertEquals((await dataExport({ authHeader: auth(CFRESH), body: { scope: 'company', company_id: X } }, deps(w))).body?.code, 'not_admin');
  assertEquals((await dataExport({ authHeader: auth(ATOTP), body: { scope: 'company', company_id: Y } }, deps(w))).body?.code, 'not_admin');
  assertEquals((await dataExport({ authHeader: auth(ATOTP), body: { scope: 'company' } }, deps(w))).status, 400);
  w.rpc.data_rights_company_role = () => 'closed';
  assertEquals((await dataExport({ authHeader: auth(ATOTP), body: { scope: 'company', company_id: X } }, deps(w))).body?.code, 'company_closed');
  assertEquals(w.reads.length, 0);
  w.rpc.data_rights_company_role = () => 'owner';
  const r = await dataExport({ authHeader: auth(ATOTP), body: { scope: 'company', company_id: X } }, deps(w));
  assertEquals(r.status, 200);
  const files = text(r.bytes!);
  assertEquals(JSON.parse(files.get('company/invoices.json')!).map((i: { id: string }) => i.id), ['i2', 'i3']);
  assertEquals(JSON.parse(files.get('company/hmrc_connections.json')!), [{ environment: 'sandbox', status: 'connected', scopes: ['read:vat'], connected_at: undefined, expires_at: undefined, updated_at: undefined }].map((o) => JSON.parse(JSON.stringify(o))));
  assertEquals(JSON.parse(files.get('company/hmrc_settings.json')!), [{ id: 'h1', user_id: A, organization_id: X, vat_number: 'GB123456789' }]);
  assertEquals(JSON.parse(files.get('company/organization_members.json')!).length, 2);
  assertEquals(JSON.parse(files.get('company/project_members.json')!).map((m: { id: string }) => m.id), ['pm1']);
  assertStringIncludes(files.get('company/vat_submissions.csv')!, '18A1');
  assertStringIncludes(files.get('company/invoices.csv')!, `"'=HYPERLINK(""x"")"`);
  assertEquals(JSON.parse(files.get('files.json')!).map((l: { path: string }) => l.path), [`${X}/t1/a.pdf`]);
  const all = [...files.values()].join('\n');
  for (const bad of ['v1.x.y.z', 'Y-SECRET-INVOICE', 'Company Y', 'shh', 'cid', `${Y}/t9`]) assert(!all.includes(bad), bad);
  assert(w.reads.filter((x) => x.table !== 'project_members' && !['project_activities', 'todo_subtasks', 'todo_comments', 'todo_history', 'team_members'].includes(x.table))
    .every((x) => x.as === 'service' && x.filter.eq.length === 1 && x.filter.eq[0][1] === X), 'every company read is filtered by company X');
  assertEquals(w.reads.find((x) => x.table === 'hmrc_connections')?.select, COMPANY_TABLES.find((t) => t.table === 'hmrc_connections')?.select);
  assert(w.rpcs.some((x) => x.fn === 'data_rights_take_slot' && x.args.p_kind === 'export_company' && x.args.p_company === X));
});

Deno.test('export: rate limit, SQL not applied yet, and a table missing from this version', async () => {
  const w = world();
  w.rpc.data_rights_take_slot = () => [{ result: 'limit' }];
  const r = await dataExport({ authHeader: auth(CFRESH), body: { scope: 'account' } }, deps(w));
  assertEquals([r.status, r.body?.code], [429, 'limit']);
  const w2 = world();
  w2.missing.add('data_rights_take_slot');
  assertEquals((await dataExport({ authHeader: auth(CFRESH), body: { scope: 'account' } }, deps(w2))).body?.code, 'not_available');
  const w3 = world();
  w3.missing.add('quotes');
  const ok = await dataExport({ authHeader: auth(CFRESH), body: { scope: 'account' } }, deps(w3));
  assertEquals(ok.status, 200);
  assertStringIncludes(text(ok.bytes!).get('README.txt')!, 'quotes: 0 row(s) (not available in this version of B2BNEST)');
});

Deno.test('account delete: check explains refusals in plain words; nothing is deleted', async () => {
  const w = world();
  w.rpc.data_rights_delete_account = () => ({ result: 'refused', reasons: ['last_owner', 'paid_subscription'], last_owner_of: ['Company X'], pays_for: [] });
  const r = await accountDelete({ authHeader: auth(ATOTP), body: { action: 'check' } }, deps(w));
  assertEquals([r.status, r.body?.code], [409, 'refused']);
  assertStringIncludes(String(r.body?.message), 'You are the only owner of Company X');
  assertStringIncludes(String(r.body?.message), 'Cancel it in Settings → Billing first');
  assertEquals(w.rpcs.map((x) => [x.fn, x.args.p_check_only]), [['data_rights_delete_account', true]]);
  const ok = await accountDelete({ authHeader: auth(CFRESH), body: { action: 'check' } }, deps(world()));
  assertEquals(ok.body?.confirm_with, 'sign_in');
});

Deno.test('account delete: needs the download tick, the typed email, a fresh sign-in, then a slot', async () => {
  const w = world();
  const call = (t: string, body: Record<string, unknown>) => accountDelete({ authHeader: auth(t), body: { action: 'delete', ...body } }, deps(w));
  assertEquals((await call(CFRESH, { email: 'cat@example.test' })).body?.code, 'confirm_download');
  assertEquals((await call(CFRESH, { downloaded: true, email: 'someone@else.test' })).body?.code, 'email_mismatch');
  assertEquals((await call(CSTALE, { downloaded: true, email: 'cat@example.test' })).body?.code, 'reauth_required');
  assertEquals((await call(ASTALE, { downloaded: true, email: 'ann@example.test' })).body?.code, 'reauth_required');
  assertEquals((await call(AAAL1, { downloaded: true, email: 'ann@example.test' })).body?.code, 'two_step_required');
  assertEquals((await call(MDEMO, { downloaded: true, email: 'demo@example.test' })).body?.code, 'demo_readonly');
  assertEquals(w.rpcs.length, 0, 'nothing reached the database');
  const r = await call(CFRESH, { downloaded: true, email: '  CAT@example.test ' });
  assertEquals(r.status, 200);
  assertStringIncludes(String(r.body?.message), 'Your account is deleted. If you needed your records, you should have downloaded them first.');
  assertEquals(w.rpcs.map((x) => x.fn), ['data_rights_take_slot', 'data_rights_delete_account']);
  assertEquals(w.rpcs[0].args.p_kind, 'account_delete');
  assertEquals(w.rpcs[1].args, { p_user: C, p_request: 'f0000000-0000-4000-8000-000000000001', p_check_only: false });
  assertEquals(w.removed, [{ bucket: 'user-avatars', paths: [`${C}/2.png`] }]);
  assert(!w.logs.join(' ').includes('cat@example.test'), 'no email in the logs');
});

Deno.test('account delete: a TOTP user deletes with a fresh code; closed companies\' attachments go too; refusals are recorded', async () => {
  const w = world();
  w.files['support-attachments'].push('0d000000-0000-4000-8000-000000000001/t/x.pdf');
  const r = await accountDelete({ authHeader: auth(ATOTP), body: { action: 'delete', downloaded: true, email: 'ann@example.test' } }, deps(w));
  assertEquals(r.status, 200);
  assertEquals(w.removed.map((x) => x.bucket), ['user-avatars', 'support-attachments']);
  const w2 = world();
  w2.rpc.data_rights_delete_account = () => ({ result: 'refused', reasons: ['billing_user'], last_owner_of: [], pays_for: ['Company X'] });
  const refused = await accountDelete({ authHeader: auth(ATOTP), body: { action: 'delete', downloaded: true, email: 'ann@example.test' } }, deps(w2));
  assertEquals(refused.status, 409);
  assertStringIncludes(String(refused.body?.message), 'You pay for the plan of Company X');
  assertEquals(w2.rpcs.at(-1), { fn: 'data_rights_finish', args: { p_request: 'f0000000-0000-4000-8000-000000000001', p_status: 'refused', p_reason: 'billing_user' } });
  assertEquals(w2.removed, []);
  const w3 = world();
  w3.rpc.data_rights_take_slot = () => [{ result: 'limit' }];
  assertEquals((await accountDelete({ authHeader: auth(ATOTP), body: { action: 'delete', downloaded: true, email: 'ann@example.test' } }, deps(w3))).status, 429);
  const w4 = world();
  w4.missing.add('data_rights_delete_account');
  assertEquals((await accountDelete({ authHeader: auth(ATOTP), body: { action: 'check' } }, deps(w4))).body?.code, 'not_available');
});

Deno.test('company close: owners only; typed name, download tick and fresh sign-in; attachments removed', async () => {
  const w = world();
  const call = (t: string, body: Record<string, unknown>) => companyClose({ authHeader: auth(t), body }, deps(w));
  assertEquals((await call(CFRESH, { action: 'check', company_id: X })).body?.code, 'not_owner');
  assertEquals((await call(ATOTP, { action: 'close' })).status, 400);
  const check = await call(ATOTP, { action: 'check', company_id: X });
  assertEquals([check.body?.name, check.body?.members, check.body?.hmrc_submissions], ['Company X', 2, 1]);
  assertEquals((await call(ATOTP, { action: 'close', company_id: X, name: 'Company X' })).body?.code, 'confirm_download');
  assertEquals((await call(ATOTP, { action: 'close', company_id: X, downloaded: true, name: 'Company Z' })).body?.code, 'name_mismatch');
  assertEquals((await call(ASTALE, { action: 'close', company_id: X, downloaded: true, name: 'Company X' })).body?.code, 'reauth_required');
  assert(!w.rpcs.some((x) => x.fn === 'data_rights_close_company' && x.args.p_check_only === false), 'nothing closed yet');
  const r = await call(ATOTP, { action: 'close', company_id: X, downloaded: true, name: ' company x ' });
  assertEquals(r.status, 200);
  assertEquals(w.rpcs.filter((x) => x.fn === 'data_rights_take_slot').at(-1)?.args, { p_user: A, p_company: X, p_kind: 'company_close', p_limit: 5 });
  assertEquals(w.removed, [{ bucket: 'support-attachments', paths: [`${X}/t1/a.pdf`] }]);
  w.rpc.data_rights_close_company = () => ({ result: 'already_closed' });
  assertEquals((await call(ATOTP, { action: 'check', company_id: X })).status, 409);
});
