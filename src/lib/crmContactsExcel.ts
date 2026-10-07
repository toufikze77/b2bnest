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
  ws.columns = CONTACT_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.key === 'notes' ? 40 : 20 }));
  ws.getRow(1).font = { bold: true, name: 'Arial' };
  rows.forEach((r) => ws.addRow(r));
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
  return String(v).trim();
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
    if (vals.some(Boolean)) out.push(vals);
  });
  return out;
}

/** Turns a sheet (header row first) into validated contact rows. Pure, so it is unit-tested. */
export function mapSheetToContacts(sheet: string[][]): { contacts: ContactRow[]; skipped: number } {
  if (sheet.length < 2) return { contacts: [], skipped: 0 };
  const headers = sheet[0].map((h) => h.toLowerCase().replace(/[_-]/g, ' ').trim());
  const idx: Partial<Record<ContactKey, number>> = {};
  CONTACT_COLUMNS.forEach((c) => {
    const i = headers.findIndex((h, j) => !Object.values(idx).includes(j) && (h === c.label.toLowerCase() || c.match.some((m) => h === m)));
    const j = i >= 0 ? i : headers.findIndex((h, k) => !Object.values(idx).includes(k) && c.match.some((m) => h.includes(m)));
    if (j >= 0) idx[c.key] = j;
  });
  const seen = new Set<string>();
  let skipped = 0;
  const contacts: ContactRow[] = [];
  for (const r of sheet.slice(1)) {
    const get = (k: ContactKey) => (idx[k] != null ? (r[idx[k]!] ?? '').trim() : '');
    const name = get('name');
    const email = get('email').toLowerCase();
    if (!name || (email && seen.has(email))) { skipped++; continue; }
    if (email) seen.add(email);
    const status = get('status').toLowerCase();
    contacts.push({
      name: name.slice(0, 200),
      email: email || null,
      phone: get('phone') || null,
      company: get('company') || null,
      position: get('position') || null,
      status: STATUSES.includes(status) ? status : 'lead',
      value: toNumber(get('value')) ?? 0,
      source: get('source') || 'Excel import',
      notes: get('notes') || null,
    });
  }
  return { contacts, skipped };
}
