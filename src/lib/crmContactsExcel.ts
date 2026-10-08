/** Excel/CSV import + export for CRM contacts. ExcelJS is loaded only when used. */
import { parseCsv, toNumber } from './csvImport';

export const CONTACT_COLUMNS = [
  { key: 'name', label: 'Name', match: ['name', 'full name', 'contact'] },
  { key: 'email', label: 'Email', match: ['email', 'e mail'] },
  { key: 'phone', label: 'Phone', match: ['phone', 'mobile', 'tel'] },
  { key: 'company', label: 'Company', match: ['company', 'organisation', 'organization', 'account'] },
  { key: 'position', label: 'Position', match: ['position', 'title', 'role', 'job'] },
  { key: 'status', label: 'Status', match: ['status', 'stage'] },
  { key: 'value', label: 'Value', match: ['value', 'amount', 'worth'] },
  { key: 'source', label: 'Source', match: ['source', 'channel'] },
  { key: 'notes', label: 'Notes', match: ['notes', 'note', 'comment'] },
] as const;

export type ContactKey = (typeof CONTACT_COLUMNS)[number]['key'];
export type ContactRow = Partial<Record<ContactKey, string | number | null>>;
const STATUSES = ['lead', 'prospect', 'customer'];

const EMAIL_RE = /^[^\s@()<>,;:"]+@[^\s@()<>,;:"]+\.[a-z]{2,}$/i;
export const EMAIL_PLACEHOLDER_PREFIX = 'Email (unverified research): ';

/** A real-looking address only. Format alone never means "verified". */
export function isUsableEmail(v?: string | null): boolean {
  return !!v && v.length <= 254 && EMAIL_RE.test(v.trim());
}

/** Returns a safe https LinkedIn profile URL found in text, or null. */
export function extractLinkedIn(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]+\/?/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return u.protocol === 'https:' && /(^|\.)linkedin\.com$/i.test(u.hostname) && u.pathname.startsWith('/in/') ? u.href : null;
  } catch { return null; }
}

/** Keeps an unusable email cell as research text inside notes, once. */
export function appendEmailPlaceholder(notes: string | null, placeholder: string): string | null {
  const ph = placeholder.trim();
  if (!ph) return notes;
  const line = EMAIL_PLACEHOLDER_PREFIX + ph;
  if ((notes || '').includes(line)) return notes;
  return notes ? `${notes}\n${line}` : line;
}

export const contactKey = (name?: string | null, company?: string | null) =>
  `${(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()}|${(company || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()}`;

async function loadExcel() {
  const mod = await import('exceljs');
  return (mod as any).default ?? mod;
}

function download(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportContactsXlsx(rows: ContactRow[], filename = 'crm-contacts.xlsx') {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Contacts');
  ws.columns = [
    ...CONTACT_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.key === 'notes' ? 60 : 20 })),
    { header: 'LinkedIn', key: 'linkedin', width: 40 },
  ];
  ws.getRow(1).font = { bold: true, name: 'Arial' };
  rows.forEach((r) => ws.addRow({ ...r, linkedin: extractLinkedIn(r.notes as string) || '' }));
  ws.getColumn('notes').alignment = { wrapText: true, vertical: 'top' };
  download(await wb.xlsx.writeBuffer(), filename);
}

export const downloadContactsTemplate = () => exportContactsXlsx([], 'crm-contacts-template.xlsx');

function cellText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.richText) return v.richText.map((t: any) => t.text).join('');
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).replace(/^\s+|\s+$/g, '');
}

export async function readSheet(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) {
    const { headers, rows } = parseCsv(await file.text());
    return headers.length ? [headers, ...rows] : [];
  }
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row: any) => {
    const vals: string[] = [];
    for (let i = 1; i <= ws.columnCount; i++) vals.push(cellText(row.getCell(i).value));
    // keep line breaks inside notes; cellText trims only the ends
    if (vals.some(Boolean)) out.push(vals);
  });
  return out;
}

export type MapResult = {
  contacts: ContactRow[];
  skipped: number;
  placeholders: number;
  withLinkedIn: number;
  unsupportedColumns: string[];
};

/** Turns a sheet (header row first) into validated contact rows. Pure, so it is unit-tested. */
export function mapSheetToContacts(sheet: string[][]): MapResult {
  const empty = { contacts: [], skipped: 0, placeholders: 0, withLinkedIn: 0, unsupportedColumns: [] };
  if (sheet.length < 2) return empty;
  const headers = sheet[0].map((h) => h.toLowerCase().replace(/[_-]/g, ' ').trim());
  const idx: Partial<Record<ContactKey, number>> = {};
  CONTACT_COLUMNS.forEach((c) => {
    const i = headers.findIndex((h, j) => !Object.values(idx).includes(j) && (h === c.label.toLowerCase() || c.match.some((m) => h === m)));
    const j = i >= 0 ? i : headers.findIndex((h, k) => !Object.values(idx).includes(k) && c.match.some((m) => h.includes(m)));
    if (j >= 0) idx[c.key] = j;
  });
  const used = new Set(Object.values(idx));
  const unsupportedColumns = sheet[0].filter((h, i) => h && !used.has(i) && headers[i] !== 'linkedin');
  const seen = new Set<string>();
  let skipped = 0, placeholders = 0, withLinkedIn = 0;
  const contacts: ContactRow[] = [];
  for (const r of sheet.slice(1)) {
    const raw = (k: ContactKey) => (idx[k] != null ? (r[idx[k]!] ?? '') : '');
    const get = (k: ContactKey) => raw(k).trim();
    const name = get('name');
    const emailCell = get('email');
    const email = isUsableEmail(emailCell) ? emailCell.toLowerCase() : null;
    const key = contactKey(name, get('company'));
    if (!name || seen.has(key) || (email && seen.has(email))) { skipped++; continue; }
    seen.add(key);
    if (email) seen.add(email);
    let notes: string | null = raw('notes').replace(/^\s+|\s+$/g, '') || null;
    if (!email && emailCell) { notes = appendEmailPlaceholder(notes, emailCell); placeholders++; }
    if (extractLinkedIn(notes)) withLinkedIn++;
    const status = get('status').toLowerCase();
    contacts.push({
      name: name.slice(0, 200),
      email,
      phone: get('phone') || null,
      company: get('company') || null,
      position: get('position') || null,
      status: STATUSES.includes(status) ? status : 'lead',
      value: toNumber(get('value')) ?? 0,
      source: get('source') || 'Excel import',
      notes,
    });
  }
  return { contacts, skipped, placeholders, withLinkedIn, unsupportedColumns };
}

/** Splits mapped rows into new ones vs ones already in the CRM (LinkedIn first, then name + company; never email domain). */
export function splitAgainstExisting(rows: ContactRow[], existing: { email?: string | null; name?: string | null; company?: string | null; notes?: string | null }[]) {
  const li = new Set(existing.map((c) => extractLinkedIn(c.notes)?.toLowerCase()).filter(Boolean) as string[]);
  const keys = new Set(existing.map((c) => contactKey(c.name, c.company)));
  const emails = new Set(existing.map((c) => (isUsableEmail(c.email) ? c.email!.toLowerCase() : '')).filter(Boolean));
  const fresh: ContactRow[] = [], overlap: ContactRow[] = [];
  for (const r of rows) {
    const l = extractLinkedIn(r.notes as string)?.toLowerCase();
    const dup = (l && li.has(l)) || keys.has(contactKey(r.name as string, r.company as string)) || (r.email && emails.has(String(r.email)));
    (dup ? overlap : fresh).push(r);
  }
  return { fresh, overlap };
}
