#!/usr/bin/env node
// Produces the single-folder form of a Supabase Edge Function for deploying from the Supabase dashboard, which
// uploads one folder only. In the repo, functions share code by importing from sibling folders
// (e.g. "../workflow-send-email/smtp.ts"); here each such file is copied into the function's folder with a prefix
// taken from the folder it came from ("wse_smtp.ts" for workflow-send-email, "shared_cors.ts" for _shared) and every
// import is rewritten to the local copy. This is the same layout production already runs for send-document-email
// (index.ts, handler.ts, wse_handler.ts, wse_smtp.ts). Test files (*_test.ts) are left out.
//
// Usage: node scripts/flatten-function.mjs <function-name> [out-dir]
//   default out-dir: dist-functions/<function-name>   (git-ignored)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');

// Relative module specifiers in import/export statements (static and dynamic).
const SPEC = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

/** "workflow-send-email" -> "wse", "_shared" -> "shared", "shared" -> "shared". */
export function prefixFor(dir) {
  const name = dir.replace(/^_+/, '');
  if (!name.includes('-')) return name;
  return name.split('-').filter(Boolean).map((w) => w[0]).join('');
}

/**
 * Returns { [fileName]: content } for the flattened function. Throws if an import cannot be resolved or would still
 * point outside the folder.
 */
export function flattenFunction(name, functionsDir = FUNCTIONS_DIR) {
  const home = path.join(functionsDir, name);
  if (!fs.existsSync(home)) throw new Error(`No function folder: ${home}`);
  const out = {};
  // absolute source path -> local file name in the output folder
  const localName = new Map();

  const nameFor = (abs) => {
    if (localName.has(abs)) return localName.get(abs);
    const dir = path.basename(path.dirname(abs));
    const local = path.dirname(abs) === home ? path.basename(abs) : `${prefixFor(dir)}_${path.basename(abs)}`;
    if ([...localName.values()].includes(local)) throw new Error(`Two files would both become ${local}`);
    localName.set(abs, local);
    return local;
  };

  const visit = (abs) => {
    const local = nameFor(abs);
    if (local in out) return local;
    out[local] = ''; // mark as in progress (cycles)
    const src = fs.readFileSync(abs, 'utf8');
    out[local] = src.replace(SPEC, (_m, lead, q, spec) => {
      const target = path.resolve(path.dirname(abs), spec);
      if (!target.startsWith(functionsDir + path.sep)) throw new Error(`${path.relative(functionsDir, abs)} imports ${spec}, outside supabase/functions`);
      if (!fs.existsSync(target)) throw new Error(`${path.relative(functionsDir, abs)} imports ${spec}, which does not exist`);
      return `${lead}${q}./${visit(target)}${q}`;
    });
    return local;
  };

  for (const f of fs.readdirSync(home).sort()) {
    if (f.endsWith('.ts') && !f.endsWith('_test.ts')) visit(path.join(home, f));
  }
  for (const [file, content] of Object.entries(out)) {
    for (const m of content.matchAll(SPEC)) {
      if (!/^\.\/[^/]+$/.test(m[3])) throw new Error(`${file} still imports ${m[3]} after flattening`);
      if (!(m[3].slice(2) in out)) throw new Error(`${file} imports ${m[3]}, which is not in the flattened folder`);
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, outArg] = process.argv.slice(2);
  if (!name) {
    console.error('Usage: node scripts/flatten-function.mjs <function-name> [out-dir]');
    process.exit(1);
  }
  const outDir = path.resolve(outArg ?? path.join(ROOT, 'dist-functions', name));
  const files = flattenFunction(name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(outDir, file), content);
  console.log(`${name}: wrote ${Object.keys(files).length} files to ${path.relative(ROOT, outDir)}: ${Object.keys(files).sort().join(', ')}`);
}
