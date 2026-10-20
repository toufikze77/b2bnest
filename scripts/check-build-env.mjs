// Runs after `vite build` (npm "postbuild"). Fails the build if the bundle does not contain the Supabase project URL
// and publishable key, so a deployment can never silently ship a build that cannot connect (the old blank white page).
// The key is checked too because the project URL also appears hard-coded in a few components; the key only gets into
// the bundle through the client settings.
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('check-build-env: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set for production (.env.production or the build environment).');
  process.exit(1);
}
const dir = path.resolve('dist/assets');
const js = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
const missing = [[url, 'the Supabase URL'], [key, 'the publishable key']].filter(([v]) => !js.some((src) => src.includes(v)));
if (missing.length) {
  console.error(`check-build-env: the built JavaScript in dist/assets does not contain ${missing.map(([, what]) => what).join(' or ')}.`);
  process.exit(1);
}
console.log(`check-build-env: OK, the build contains ${url} and its publishable key.`);
