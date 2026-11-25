import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenFunction, FUNCTIONS_DIR } from '../../scripts/flatten-function.mjs';

// Repo checks for supabase/functions: config.toml never points at a missing folder, and every function can be
// flattened into a single folder (what the Supabase dashboard deploys) with no import left outside it.
const config = fs.readFileSync(path.resolve(FUNCTIONS_DIR, '..', 'config.toml'), 'utf8');
const configured = [...config.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((m) => m[1]);
const folders = fs.readdirSync(FUNCTIONS_DIR).filter((d) => !['_shared', 'shared'].includes(d) && fs.statSync(path.join(FUNCTIONS_DIR, d)).isDirectory());

describe('supabase/functions', () => {
  it('config.toml lists functions', () => {
    expect(configured.length).toBeGreaterThan(20);
  });

  it('every function in config.toml has a folder with an index.ts', () => {
    const missing = configured.filter((f) => !fs.existsSync(path.join(FUNCTIONS_DIR, f, 'index.ts')));
    expect(missing).toEqual([]);
  });

  it('the removed ai-business-assistant is gone from the repo and config', () => {
    expect(folders).not.toContain('ai-business-assistant');
    expect(configured).not.toContain('ai-business-assistant');
  });

  it.each(folders)('%s flattens to one folder with no import outside it', (name) => {
    const files = flattenFunction(name);
    expect(files['index.ts']).toBeDefined();
    for (const [file, content] of Object.entries(files)) {
      expect(content, `${name}/${file}`).not.toMatch(/(from|import)\s*\(?\s*["']\.\.\//);
    }
  });

  // send-document-email is what production already runs flattened (index.ts, handler.ts, wse_handler.ts, wse_smtp.ts).
  // Demo read-only: send-document-email also carries the demo guard (docs/demo-readonly), so two shared files are added.
  it.each(['onboarding-email-sender', 'support-email-sender', 'send-document-email'])('%s flattens to the production layout', (name) => {
    const files = flattenFunction(name);
    const demo = name === 'send-document-email' ? ['shared_cors.ts', 'shared_demo-guard.ts'] : [];
    expect(Object.keys(files).sort()).toEqual(['handler.ts', 'index.ts', ...demo, 'wse_handler.ts', 'wse_smtp.ts'].sort());
    expect(files['wse_smtp.ts']).toContain('from "./wse_handler.ts"');
    expect(files['wse_handler.ts']).toBe(fs.readFileSync(path.join(FUNCTIONS_DIR, 'workflow-send-email', 'handler.ts'), 'utf8'));
  });

  it.each(['onboarding-email-sender', 'support-email-sender'])('%s keeps its handler byte-for-byte when flattened', (name) => {
    expect(flattenFunction(name)['handler.ts']).toBe(fs.readFileSync(path.join(FUNCTIONS_DIR, name, 'handler.ts'), 'utf8'));
  });

  it('the email senders stay off by default and refuse the Gmail fallback (source check)', () => {
    for (const [name, flag] of [['onboarding-email-sender', 'ONBOARDING_EMAIL_ENABLED'], ['support-email-sender', 'SUPPORT_EMAIL_ENABLED']]) {
      const handler = fs.readFileSync(path.join(FUNCTIONS_DIR, name, 'handler.ts'), 'utf8');
      const index = fs.readFileSync(path.join(FUNCTIONS_DIR, name, 'index.ts'), 'utf8');
      expect(handler).toContain(`d.env("${flag}") !== "true"`);
      expect(index).toContain('smtpOnly(resolveSmtp(');
      expect(index).not.toMatch(/GMAIL_/);
    }
  });

  // Phase 12: no AI after the trial ends. The access check runs as the caller, before any credit or model call.
  // Phase 20: the request handling moved to handler.ts (dependencies injected); index.ts builds the caller's client.
  it.each(['ai-assistant', 'business-insights'])('%s checks my_access_state before spending credits or calling a model', (name) => {
    const index = fs.readFileSync(path.join(FUNCTIONS_DIR, name, 'index.ts'), 'utf8');
    const src = fs.readFileSync(path.join(FUNCTIONS_DIR, name, 'handler.ts'), 'utf8');
    // index.ts: checkAccess runs with the caller's JWT (anon key + their Authorization header), never the service role.
    expect(index).toMatch(/checkAccess: \(authHeader\) =>\s*checkAccess\(createClient\(supabaseUrl, Deno\.env\.get\('SUPABASE_ANON_KEY'\)!, \{ global: \{ headers: \{ Authorization: authHeader \} \} \}\)\)/);
    const check = src.indexOf('await deps.checkAccess(auth)');
    expect(check).toBeGreaterThan(0);
    for (const later of ['deps.deduct(', 'deps.openai(']) {
      const at = src.indexOf(later);
      if (at >= 0) expect(at, later).toBeGreaterThan(check);
    }
    expect(src.slice(check, check + 200)).toContain('json(access.status, access.body)');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// verify_jwt: the deploy CLI takes it from config.toml and defaults to TRUE when a function has no entry. These are the
// functions production runs with verify_jwt = false (owner-maintained list; read with list_edge_functions on
// 22 Nov 2026). Each must have an explicit `verify_jwt = false` entry, or a plain deploy turns the gateway check on.
// Also false in production on 22 Nov 2026 but not yet recorded in config.toml (owner to decide; see the PR):
// oauth-gmail-callback, oauth-google-calendar, slack-commands, slack-interactions, sync-note-to-email.
// ---------------------------------------------------------------------------------------------------------------------
const PRODUCTION_VERIFY_JWT_FALSE = [
  'activate-trial', 'ai-assistant', 'b2b-form-submit', 'business-insights', 'create-coinbase-charge', 'create-payment', 'firecrawl-scrape',
  'generate-template', 'get-oauth-config', 'google-calendar-sync', 'notion-sync', 'oauth-facebook', 'oauth-gmail-init', 'oauth-icloud-calendar',
  'oauth-linkedin', 'oauth-onedrive', 'oauth-outlook-calendar', 'oauth-outlook-init', 'oauth-twitter', 'oauth-twitter-request', 'public-work-request',
  'send-2fa-email', 'share-project', 'share-task', 'sign-oauth-state', 'store-twitter-credentials', 'stripe-webhook', 'trello-import',
  'truelayer-integration', 'verify-2fa-code', 'whatsapp-connect', 'whatsapp-disconnect', 'workflow-execute',
  // Added 25 Nov 2026, not yet deployed: deploy it with this setting (it checks the caller's token itself).
  'store-oauth-client',
];
/** verify_jwt per [functions.<name>] section (undefined when the function has no entry or no verify_jwt line). */
function verifyJwtSettings(toml: string): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const m of toml.matchAll(/^\[functions\.([^\]]+)\]\s*\n((?:(?!\[)[^\n]*\n?)*)/gm)) {
    const v = /^\s*verify_jwt\s*=\s*(true|false)\s*$/m.exec(m[2]);
    if (v) out.set(m[1], v[1] === 'true');
  }
  return out;
}
const servesRequests = (name: string) => {
  const index = path.join(FUNCTIONS_DIR, name, 'index.ts');
  return fs.existsSync(index) && /\bserve\b|Deno\.serve|Serve(Narrow)?\(/.test(fs.readFileSync(index, 'utf8'));
};

describe('config.toml verify_jwt mirrors production', () => {
  const settings = verifyJwtSettings(config);
  it('reads the settings (sanity)', () => {
    expect(settings.get('stripe-webhook')).toBe(false);
    expect(settings.get('data-export')).toBe(true);
    expect(verifyJwtSettings('[functions.a]\nverify_jwt = false\n\n[functions.b]\nverify_jwt = true\n')).toEqual(new Map([['a', false], ['b', true]]));
  });
  it('every function production runs with verify_jwt = false has an explicit false entry', () => {
    const wrong = PRODUCTION_VERIFY_JWT_FALSE.filter((f) => folders.includes(f) && servesRequests(f) && settings.get(f) !== false);
    expect(wrong).toEqual([]);
  });
  it('the list names real functions that serve requests', () => {
    expect(PRODUCTION_VERIFY_JWT_FALSE.filter((f) => !folders.includes(f) || !servesRequests(f))).toEqual([]);
  });
  it('each function has at most one entry', () => {
    expect(configured.filter((f, i) => configured.indexOf(f) !== i)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// auth.getClaims exists only in recent supabase-js. On an older pinned client it throws "getClaims is not a function"
// (sign-oauth-state answered 500 on every call, 25 Nov 2026, so every Connect button stopped). A function that calls
// it must import supabase-js 2.58 or later (or the unpinned @2); otherwise use auth.getUser(token).
// ---------------------------------------------------------------------------------------------------------------------
const MIN_GETCLAIMS = [2, 58] as const;
/** Pinned supabase-js versions in a source file: esm.sh / npm / jsr specifiers ("2" alone counts as current). */
function supabaseJsVersions(src: string): string[] {
  return [...src.matchAll(/supabase-js@(\d+(?:\.\d+){0,2})/g)].map((m) => m[1]);
}
function olderThanMin(v: string): boolean {
  const [maj, min = Number.POSITIVE_INFINITY] = v.split('.').map(Number);
  return maj < MIN_GETCLAIMS[0] || (maj === MIN_GETCLAIMS[0] && min < MIN_GETCLAIMS[1]);
}

describe('auth.getClaims needs a recent supabase-js', () => {
  it('reads versions (sanity)', () => {
    expect(supabaseJsVersions("import x from 'https://esm.sh/@supabase/supabase-js@2.45.0'; import 'npm:@supabase/supabase-js@2'")).toEqual(['2.45.0', '2']);
    expect(['2.45.0', '2.39.3', '2.50.2', '2.57.9'].map(olderThanMin)).toEqual([true, true, true, true]);
    expect(['2', '2.58.0', '2.60.1', '3.0.0'].map(olderThanMin)).toEqual([false, false, false, false]);
  });
  it('no function calls auth.getClaims while importing supabase-js older than 2.58', () => {
    const bad = folders.filter((name) => {
      const index = path.join(FUNCTIONS_DIR, name, 'index.ts');
      if (!fs.existsSync(index)) return false;
      const src = fs.readFileSync(index, 'utf8');
      return /\.auth\s*\.\s*getClaims\s*\(/.test(src) && supabaseJsVersions(src).some(olderThanMin);
    });
    expect(bad).toEqual([]);
  });
});
