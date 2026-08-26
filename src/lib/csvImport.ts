/** Lightweight CSV parsing + column auto-mapping helpers used by the migration wizard. */

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  /** lowercase substrings used to auto-detect the matching CSV header */
  match?: string[];
  hint?: string;
};

export const SKIP = '__skip__';

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQ = !inQ;
    } else if ((c === ',' || c === ';' || c === '\t') && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const all = lines.map(parseLine);
  return { headers: all[0], rows: all.slice(1) };
}

export function autoMap(headers: string[], fields: ImportField[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const l = h.toLowerCase().replace(/[_-]/g, ' ').trim();
    const hit = fields.find(
      (f) =>
        !used.has(f.key) &&
        (l === f.label.toLowerCase() ||
          l === f.key.toLowerCase() ||
          (f.match || []).some((m) => l.includes(m))),
    );
    if (hit) {
      mapping[i] = hit.key;
      used.add(hit.key);
    } else {
      mapping[i] = SKIP;
    }
  });
  return mapping;
}

export function rowToObject(
  row: string[],
  mapping: Record<number, string>,
): Record<string, string> {
  const obj: Record<string, string> = {};
  Object.entries(mapping).forEach(([idx, key]) => {
    if (key === SKIP) return;
    const v = (row[Number(idx)] ?? '').trim();
    if (v) obj[key] = v;
  });
  return obj;
}

export function downloadTemplate(filename: string, fields: ImportField[]) {
  const csv = fields.map((f) => f.label).join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toNumber(v?: string): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function toDate(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
