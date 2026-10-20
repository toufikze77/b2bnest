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
  it.each(['onboarding-email-sender', 'support-email-sender', 'send-document-email'])('%s flattens to the production layout', (name) => {
    const files = flattenFunction(name);
    expect(Object.keys(files).sort()).toEqual(['handler.ts', 'index.ts', 'wse_handler.ts', 'wse_smtp.ts']);
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
});
