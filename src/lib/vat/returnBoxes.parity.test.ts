// HMRC P6: the Edge Function (hmrc-vat-submit) recomputes the nine boxes with a copy of these files
// (supabase/functions/_shared/vat/, Deno needs ".ts" imports). The copy must stay identical, apart from its first line
// and the import extensions, so the screen and the submission can never disagree.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeReturnBoxes, type PreviewRow } from './returnBoxes';

const ROOT = path.resolve(__dirname, '../../..');
const FILES = ['money', 'treatments', 'returnRules', 'returnBoxes'];

describe('server copy of the VAT box maths', () => {
  it.each(FILES)('%s.ts is identical in src/lib/vat and supabase/functions/_shared/vat', (f) => {
    const app = fs.readFileSync(path.join(ROOT, 'src/lib/vat', `${f}.ts`), 'utf8');
    const server = fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/vat', `${f}.ts`), 'utf8');
    const [first, ...rest] = server.split('\n');
    expect(first).toMatch(/^\/\/ COPY of src\/lib\/vat\//);
    expect(rest.join('\n').replace(/from '\.\/(money|treatments|returnRules)\.ts'/g, "from './$1'")).toBe(app);
  });

  it('gives the same boxes on the same rows', async () => {
    const serverPath = path.join(ROOT, 'supabase/functions/_shared/vat/returnBoxes.ts');
    const server = (await import(/* @vite-ignore */ serverPath)) as { computeReturnBoxes: typeof computeReturnBoxes };
    const rows: PreviewRow[] = [
      { row_kind: 'included', source: 'invoices', treatment: 'standard', reason: null, records: 2, net: '1000.10', vat: '200.02', vat_not_reclaimable: 0 },
      { row_kind: 'included', source: 'invoices', treatment: 'outside_scope', reason: null, records: 1, net: 300, vat: 0, vat_not_reclaimable: 0 },
      { row_kind: 'included', source: 'bills', treatment: 'reduced', reason: null, records: 1, net: '33.33', vat: '1.67', vat_not_reclaimable: 0 },
      { row_kind: 'included', source: 'expenses', treatment: 'standard', reason: null, records: 1, net: 150, vat: 0, vat_not_reclaimable: 30 },
      { row_kind: 'left_out', source: 'expenses', treatment: null, reason: 'vat_not_reclaimable', records: 1, net: 0, vat: 0, vat_not_reclaimable: 30 },
    ];
    expect(server.computeReturnBoxes(rows)).toEqual(computeReturnBoxes(rows));
  });
});
