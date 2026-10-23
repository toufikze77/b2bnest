// CI lint gate: fails only if ESLint finds MORE problems (errors + warnings) than the number stored in .eslint-baseline.
// The count can only go down: when it drops, lower the baseline in the same pull request.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const baseline = Number(fs.readFileSync('.eslint-baseline', 'utf8').trim());
if (!Number.isInteger(baseline) || baseline < 0) {
  console.error('check-lint-baseline: .eslint-baseline must hold one whole number.');
  process.exit(1);
}

let out;
try {
  out = execFileSync('npx', ['eslint', '.', '-f', 'json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
} catch (e) {
  // ESLint exits 1 when it finds errors; the JSON report is still on stdout.
  if (!e.stdout) throw e;
  out = e.stdout;
}
const results = JSON.parse(out);
const count = results.reduce((n, f) => n + f.errorCount + f.warningCount, 0);

if (count > baseline) {
  console.error(`check-lint-baseline: ${count} problems, more than the baseline of ${baseline}. Fix the new problems (run npx eslint .).`);
  process.exit(1);
}
console.log(`check-lint-baseline: ${count} problems (baseline ${baseline}).${count < baseline ? ` Lower .eslint-baseline to ${count}.` : ''}`);
