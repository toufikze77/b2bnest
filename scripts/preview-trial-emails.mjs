#!/usr/bin/env node
// Renders the three Phase 13 trial emails with dummy data to docs/phase13/previews/ (HTML and plain text), so the owner
// can open them. Uses the real templates (supabase/functions/_shared/trial-emails.ts, bundled with esbuild); sends nothing.
// Usage: node scripts/preview-trial-emails.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'phase13', 'previews');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trial-emails-')), 'trial-emails.mjs');
await build({ entryPoints: [path.join(ROOT, 'supabase/functions/_shared/trial-emails.ts')], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'silent' });
const { renderTrialEmail, TRIAL_EMAIL_KINDS } = await import(pathToFileURL(tmp).href);

// Dummy data only: a fictional person, a trial ending 3 days after "now", an all-zero-looking token.
const now = Date.parse('2026-10-29T09:00:00Z');
const day = 86_400_000;
const sample = {
  ending_soon: { trialEndsAt: new Date(now + 3 * day).toISOString(), daysLeft: 3 },
  ended: { trialEndsAt: new Date(now - 0.5 * day).toISOString(), daysLeft: 0 },
  follow_up: { trialEndsAt: new Date(now - 3 * day).toISOString(), daysLeft: 0 },
};
fs.mkdirSync(OUT, { recursive: true });
for (const kind of TRIAL_EMAIL_KINDS) {
  const m = renderTrialEmail({ kind, to: 'sam.example@example.com', firstName: 'Sam', unsubscribeToken: '0'.repeat(64), ...sample[kind] });
  fs.writeFileSync(path.join(OUT, `${kind}.html`), m.html);
  fs.writeFileSync(path.join(OUT, `${kind}.txt`), `Subject: ${m.subject}\n\n${m.text}`);
  console.log(`${kind}: ${m.subject}`);
}
console.log(`Wrote ${TRIAL_EMAIL_KINDS.length * 2} files to ${path.relative(ROOT, OUT)}/`);
