// Finance phase 3c-1: reading a bank statement CSV in the browser (docs/ledger-bank/README.md). Pure functions, no I/O:
// the file never leaves the browser; only the rows built here go to ledger_bank_import, in chunks of 500.
// Money is whole pence from the text itself (no floating point): "1,234.56" -> 123456, "(12.30)" -> -1230.
// Dates are UK order: 01/03/2026 is 1 March 2026, never 3 January.

export interface BankRow { date: string; description: string; amount_pence: number; balance_pence?: number; ref?: string; seq?: number }
export interface RowProblem { line: number; reason: string }
export type ColumnKey = 'date' | 'description' | 'amount' | 'money_in' | 'money_out' | 'balance' | 'reference';
/** Column index for each field (-1 = not used). Either amount, or money_in and/or money_out. */
export type ColumnMap = Record<ColumnKey, number>;

export const CHUNK_SIZE = 500;
export const MAX_FILE_ROWS = 10000;
export const MIN_DATE = '2000-01-01';
export const COLUMN_LABELS: Record<ColumnKey, string> = {
  date: 'Date', description: 'Description', amount: 'Amount (money out is negative)', money_in: 'Money in', money_out: 'Money out',
  balance: 'Balance (optional)', reference: 'Reference (optional)',
};

// ------------------------------------------------------------------ CSV text to cells

/** Splits CSV text into rows of cells: quotes, doubled quotes, commas/newlines inside quotes, BOM, CRLF. The separator
 * is a comma unless the first line has more semicolons or tabs. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '');
  const firstLine = t.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = count(';') > count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"' && cell.trim() === '') { quoted = true; cell = ''; }
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

// ------------------------------------------------------------------ money and dates

/** Whole pence from a statement amount, or null if it can't be read. Accepts £, commas between thousands, spaces,
 * a leading or trailing minus, brackets for negative, a leading plus, and CR / DR (DR is money out). */
export function parsePence(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\u00a0/g, ' ');
  if (s === '') return null;
  // One sign at most: DR/CR, brackets, a plus, or a minus (before or after the number, or after the £). Two: unreadable.
  let negative = false; let signs = 0;
  const crdr = /\s*(CR|DR)$/i.exec(s);
  if (crdr) { negative = crdr[1].toUpperCase() === 'DR'; signs++; s = s.slice(0, crdr.index).trim(); }
  if (/^\(.*\)$/.test(s)) { negative = true; signs++; s = s.slice(1, -1).trim(); }
  if (/^[-\u2212]/.test(s)) { negative = true; signs++; s = s.slice(1).trim(); } else if (/[-\u2212]$/.test(s)) { negative = true; signs++; s = s.slice(0, -1).trim(); }
  else if (s.startsWith('+')) { signs++; s = s.slice(1).trim(); }
  s = s.replace(/^(GBP|£)\s*/i, '').replace(/\s*(GBP|£)$/i, '');
  if (/^[-\u2212]/.test(s)) { negative = true; signs++; s = s.slice(1).trim(); }
  if (signs > 1) return null;
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^\.\d+$/.test(s.replace(/ (?=\d{3}\b)/g, ''))) return null;
  s = s.replace(/[, ]/g, '');
  const [whole, frac = ''] = s.split('.');
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) return null; // fractions of a penny
  const pence = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(pence)) return null;
  return negative && pence !== 0 ? -pence : pence;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number): string | null => {
  if (m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** 'YYYY-MM-DD' from a statement date, UK order, or null: 2026-03-01, 01/03/2026, 1-3-26, 01.03.2026, 1 Mar 2026, 01-Mar-26,
 * and an ISO date with a time after it. */
export function parseUkDate(raw: string | undefined | null): string | null {
  const s = String(raw ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?: .*)?$/.exec(s);
  if (m) return iso(fullYear(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]*(\d{2}|\d{4})$/.exec(s);
  if (m) { const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); return mo < 0 ? null : iso(fullYear(m[3]), mo + 1, Number(m[1])); }
  return null;
}

/** The same normalisation as the database (so identical rows are counted the same way): trimmed, single spaces. */
export const normaliseText = (s: string) => s.replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ columns

const WORDS: Record<ColumnKey, RegExp> = {
  date: /^(transaction |posting |value |booking )?date$|^date( posted| of transaction)?$|^trans(action)? date$/i,
  description: /^(description|details|narrative|transaction description|memo|payee|name|particulars|reference and description|transaction details)$/i,
  amount: /^(amount|value|amount \(gbp\)|amount gbp|transaction amount|net amount|£ ?amount|amount ?\(£\))$/i,
  money_in: /^(money in|paid in|credit|credits|in|credit amount|deposits?|receipts?|money in \(£\)|paid in \(£\))$/i,
  money_out: /^(money out|paid out|debit|debits|out|debit amount|withdrawals?|payments?|money out \(£\)|paid out \(£\))$/i,
  balance: /^(balance|running balance|balance \(£\)|balance gbp|closing balance)$/i,
  reference: /^(reference|ref|transaction reference|cheque number|check number|ref\.?|transaction id|id)$/i,
};
const blankMap = (): ColumnMap => ({ date: -1, description: -1, amount: -1, money_in: -1, money_out: -1, balance: -1, reference: -1 });

/** Guesses which column is which from the header names. */
export function detectColumns(header: string[]): ColumnMap {
  const map = blankMap();
  const names = header.map((h) => normaliseText(h).replace(/[:*]$/, ''));
  (Object.keys(WORDS) as ColumnKey[]).forEach((k) => { map[k] = names.findIndex((n, i) => WORDS[k].test(n) && !Object.values(map).includes(i)); });
  // A "Type" or second free-text column is not the description; but if none matched, take the widest text-like name.
  if (map.description < 0) map.description = names.findIndex((n, i) => /desc|detail|narr|payee|merchant/i.test(n) && !Object.values(map).includes(i));
  if (map.amount >= 0 && (map.money_in >= 0 || map.money_out >= 0)) map.amount = -1; // separate in/out columns win
  return map;
}
export const mappingReady = (m: ColumnMap) => m.date >= 0 && m.description >= 0 && (m.amount >= 0 || m.money_in >= 0 || m.money_out >= 0);

/** The header row: the first of the first 15 rows whose names map date, description and an amount (banks often put an
 * account summary above the table). Falls back to the first row. */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) if (mappingReady(detectColumns(rows[i]))) return i;
  return 0;
}

// ------------------------------------------------------------------ rows

export interface Built { rows: BankRow[]; problems: RowProblem[]; skippedZero: number }

/** Statement rows from the cells below the header. A row that can't be read, or whose date is outside 1 Jan 2000 to
 * tomorrow, is a problem (listed, not imported); a zero-amount row (an information line) is skipped and counted. */
export function buildRows(cells: string[][], headerRow: number, map: ColumnMap, today: string): Built {
  const rows: BankRow[] = []; const problems: RowProblem[] = []; let skippedZero = 0;
  const tomorrow = addDays(today, 1);
  const at = (r: string[], i: number) => (i >= 0 ? r[i] ?? '' : '');
  for (let i = headerRow + 1; i < cells.length; i++) {
    const r = cells[i]; const line = i + 1;
    const date = parseUkDate(at(r, map.date));
    if (!date) { problems.push({ line, reason: `the date "${at(r, map.date) || '(empty)'}" can't be read` }); continue; }
    if (date < MIN_DATE || date > tomorrow) { problems.push({ line, reason: `the date ${date} is outside 1 January 2000 to tomorrow` }); continue; }
    let amount: number | null;
    if (map.amount >= 0) amount = parsePence(at(r, map.amount));
    else {
      const inRaw = at(r, map.money_in); const outRaw = at(r, map.money_out);
      const pIn = inRaw === '' ? 0 : parsePence(inRaw); const pOut = outRaw === '' ? 0 : parsePence(outRaw);
      amount = pIn === null || pOut === null || (inRaw === '' && outRaw === '') ? null : pIn - Math.abs(pOut);
    }
    if (amount === null) { problems.push({ line, reason: 'the amount can\'t be read' }); continue; }
    if (amount === 0) { skippedZero++; continue; }
    const description = normaliseText(at(r, map.description)).slice(0, 500);
    if (!description) { problems.push({ line, reason: 'the description is empty' }); continue; }
    const row: BankRow = { date, description, amount_pence: amount };
    const balRaw = at(r, map.balance);
    if (balRaw !== '') {
      const b = parsePence(balRaw);
      if (b === null) { problems.push({ line, reason: 'the balance can\'t be read' }); continue; }
      row.balance_pence = b;
    }
    const ref = normaliseText(at(r, map.reference)).slice(0, 100);
    if (ref) row.ref = ref;
    rows.push(row);
  }
  return { rows: withSeq(rows), problems, skippedZero };
}

/** Numbers identical rows (date, amount, description, reference) across the whole file, so two genuine identical
 * payments are both kept and a file sent in several chunks is numbered as one. */
export function withSeq(rows: BankRow[]): BankRow[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const k = JSON.stringify([r.date, r.amount_pence, r.description, r.ref ?? null]);
    const n = (seen.get(k) ?? 0) + 1; seen.set(k, n);
    return { ...r, seq: n };
  });
}

export function chunk<T>(xs: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function totals(rows: BankRow[]) {
  let moneyIn = 0; let moneyOut = 0; let first: string | null = null; let last: string | null = null;
  for (const r of rows) {
    if (r.amount_pence > 0) moneyIn += r.amount_pence; else moneyOut += -r.amount_pence;
    if (!first || r.date < first) first = r.date;
    if (!last || r.date > last) last = r.date;
  }
  return { count: rows.length, moneyIn, moneyOut, first, last };
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "120 imported, 4 already imported, 0 rejected". */
export const importResultText = (x: { imported: number; skipped: number; rejected: number }) =>
  `${x.imported} imported, ${x.skipped} already imported, ${x.rejected} rejected`;
