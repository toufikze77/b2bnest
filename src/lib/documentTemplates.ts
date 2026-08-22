import jsPDF from 'jspdf';
import { formatCurrency } from '@/utils/currencyUtils';

export type DocumentTemplateId = 'classic' | 'modern' | 'minimal' | 'bold' | 'corporate';

export interface DocumentTemplate {
  id: DocumentTemplateId;
  name: string;
  description: string;
  /** RGB accent used for headings/bands */
  accent: [number, number, number];
  /** Secondary/ink colour */
  ink: [number, number, number];
  headerStyle: 'band' | 'rule' | 'sidebar' | 'plain' | 'dark';
  font: 'helvetica' | 'times';
  zebraRows: boolean;
  uppercaseTitle: boolean;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional serif layout with ruled table — timeless and formal.',
    accent: [31, 58, 95],
    ink: [40, 40, 40],
    headerStyle: 'rule',
    font: 'times',
    zebraRows: false,
    uppercaseTitle: true,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Coloured header band with clean sans-serif typography.',
    accent: [37, 99, 235],
    ink: [55, 65, 81],
    headerStyle: 'band',
    font: 'helvetica',
    zebraRows: true,
    uppercaseTitle: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Lots of whitespace, hairline rules, no heavy colour blocks.',
    accent: [17, 24, 39],
    ink: [90, 90, 90],
    headerStyle: 'plain',
    font: 'helvetica',
    zebraRows: false,
    uppercaseTitle: false,
  },
  {
    id: 'bold',
    name: 'Bold Accent',
    description: 'Vertical accent sidebar and oversized totals — high impact.',
    accent: [219, 39, 119],
    ink: [45, 45, 45],
    headerStyle: 'sidebar',
    font: 'helvetica',
    zebraRows: true,
    uppercaseTitle: true,
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Dark slate header with zebra-striped items — enterprise ready.',
    accent: [15, 23, 42],
    ink: [51, 65, 85],
    headerStyle: 'dark',
    font: 'helvetica',
    zebraRows: true,
    uppercaseTitle: true,
  },
];

export const getTemplate = (id?: string | null): DocumentTemplate =>
  DOCUMENT_TEMPLATES.find((t) => t.id === id) ?? DOCUMENT_TEMPLATES[1];

export interface RenderableDocument {
  type: 'quote' | 'invoice';
  number?: string | null;
  created_at?: string | null;
  status?: string | null;
  valid_until?: string | null;
  due_date?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  items?: any;
  subtotal?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  notes?: string | null;
}

const PAGE_W = 210;
const MARGIN = 18;

const parseItems = (items: any): any[] => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    const parsed = typeof items === 'string' ? JSON.parse(items) : items;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '');

/**
 * Renders a quote/invoice into a styled jsPDF document using the chosen template.
 */
export function renderDocumentPdf(
  doc: RenderableDocument,
  templateId: string | null | undefined,
  currency = 'GBP',
): jsPDF {
  const t = getTemplate(templateId);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const items = parseItems(doc.items);
  const title = doc.type === 'quote' ? 'Quote' : 'Invoice';
  const left = t.headerStyle === 'sidebar' ? MARGIN + 8 : MARGIN;
  const right = PAGE_W - MARGIN;
  const money = (n: number) => formatCurrency(Number(n) || 0, currency);

  pdf.setFont(t.font, 'normal');

  // ---------- Header ----------
  let y = 0;
  if (t.headerStyle === 'band' || t.headerStyle === 'dark') {
    pdf.setFillColor(...t.accent);
    pdf.rect(0, 0, PAGE_W, 38, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(t.font, 'bold');
    pdf.setFontSize(20);
    pdf.text(doc.company_name || 'Your Company', left, 18);
    pdf.setFont(t.font, 'normal');
    pdf.setFontSize(9);
    (doc.company_address || '').split('\n').slice(0, 2).forEach((line, i) => {
      pdf.text(line, left, 25 + i * 4.5);
    });
    pdf.setFont(t.font, 'bold');
    pdf.setFontSize(22);
    pdf.text(t.uppercaseTitle ? title.toUpperCase() : title, right, 20, { align: 'right' });
    y = 50;
  } else {
    if (t.headerStyle === 'sidebar') {
      pdf.setFillColor(...t.accent);
      pdf.rect(0, 0, 6, 297, 'F');
    }
    pdf.setTextColor(...t.accent);
    pdf.setFont(t.font, 'bold');
    pdf.setFontSize(19);
    pdf.text(doc.company_name || 'Your Company', left, 24);
    pdf.setTextColor(...t.ink);
    pdf.setFont(t.font, 'normal');
    pdf.setFontSize(9);
    (doc.company_address || '').split('\n').slice(0, 2).forEach((line, i) => {
      pdf.text(line, left, 30 + i * 4.5);
    });
    pdf.setTextColor(...t.accent);
    pdf.setFont(t.font, 'bold');
    pdf.setFontSize(t.headerStyle === 'plain' ? 18 : 22);
    pdf.text(t.uppercaseTitle ? title.toUpperCase() : title, right, 24, { align: 'right' });
    if (t.headerStyle === 'rule') {
      pdf.setDrawColor(...t.accent);
      pdf.setLineWidth(0.8);
      pdf.line(left, 42, right, 42);
    } else if (t.headerStyle === 'plain') {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.2);
      pdf.line(left, 42, right, 42);
    }
    y = 52;
  }

  // ---------- Meta + parties ----------
  pdf.setTextColor(...t.ink);
  pdf.setFontSize(9);
  pdf.setFont(t.font, 'bold');
  pdf.text('BILL TO', left, y);
  pdf.text(`${title.toUpperCase()} DETAILS`, right, y, { align: 'right' });
  pdf.setFont(t.font, 'normal');

  let leftY = y + 6;
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text(doc.client_name || '-', left, leftY);
  pdf.setFontSize(9);
  pdf.setTextColor(...t.ink);
  leftY += 5;
  if (doc.client_email) {
    pdf.text(doc.client_email, left, leftY);
    leftY += 4.5;
  }
  (doc.client_address || '').split('\n').slice(0, 4).forEach((line) => {
    pdf.text(line, left, leftY);
    leftY += 4.5;
  });

  const meta: [string, string][] = [
    ['Number', doc.number || '-'],
    ['Date', fmtDate(doc.created_at) || new Date().toLocaleDateString()],
  ];
  if (doc.type === 'quote' && doc.valid_until) meta.push(['Valid until', fmtDate(doc.valid_until)]);
  if (doc.type === 'invoice' && doc.due_date) meta.push(['Due date', fmtDate(doc.due_date)]);
  if (doc.status) meta.push(['Status', String(doc.status)]);

  let rightY = y + 6;
  pdf.setFontSize(9);
  meta.forEach(([k, v]) => {
    pdf.setTextColor(130, 130, 130);
    pdf.text(k, right - 42, rightY, { align: 'right' });
    pdf.setTextColor(20, 20, 20);
    pdf.text(v, right, rightY, { align: 'right' });
    rightY += 5;
  });

  y = Math.max(leftY, rightY) + 10;

  // ---------- Items table ----------
  const colQty = right - 78;
  const colRate = right - 44;
  const colAmt = right;
  const rowH = 8;

  if (t.headerStyle === 'plain') {
    pdf.setDrawColor(210, 210, 210);
    pdf.setLineWidth(0.2);
    pdf.line(left, y + 2, right, y + 2);
    pdf.setTextColor(120, 120, 120);
  } else {
    pdf.setFillColor(...t.accent);
    pdf.rect(left, y - 4.5, right - left, rowH, 'F');
    pdf.setTextColor(255, 255, 255);
  }
  pdf.setFont(t.font, 'bold');
  pdf.setFontSize(9);
  pdf.text('DESCRIPTION', left + 3, y + 0.5);
  pdf.text('QTY', colQty, y + 0.5, { align: 'right' });
  pdf.text('RATE', colRate, y + 0.5, { align: 'right' });
  pdf.text('AMOUNT', colAmt - 3, y + 0.5, { align: 'right' });
  y += rowH + 2;

  pdf.setFont(t.font, 'normal');
  pdf.setTextColor(...t.ink);

  items.forEach((item: any, idx: number) => {
    const desc = pdf.splitTextToSize(String(item.description || ''), right - left - 90);
    const blockH = Math.max(rowH, desc.length * 4.6 + 3.5);

    if (y + blockH > 262) {
      pdf.addPage();
      y = MARGIN + 8;
    }

    if (t.zebraRows && idx % 2 === 1) {
      pdf.setFillColor(245, 246, 248);
      pdf.rect(left, y - 5, right - left, blockH, 'F');
    }

    pdf.setTextColor(...t.ink);
    pdf.text(desc, left + 3, y);
    pdf.text(String(item.quantity ?? 0), colQty, y, { align: 'right' });
    pdf.text(money(item.rate), colRate, y, { align: 'right' });
    pdf.setTextColor(20, 20, 20);
    pdf.text(money(item.amount), colAmt - 3, y, { align: 'right' });

    if (!t.zebraRows) {
      pdf.setDrawColor(228, 228, 228);
      pdf.setLineWidth(0.15);
      pdf.line(left, y + blockH - 5.5, right, y + blockH - 5.5);
    }
    y += blockH;
  });

  // ---------- Totals ----------
  y += 8;
  if (y > 240) {
    pdf.addPage();
    y = MARGIN + 10;
  }
  const totalsLeft = right - 70;
  pdf.setFontSize(10);
  pdf.setTextColor(...t.ink);
  pdf.text('Subtotal', totalsLeft, y);
  pdf.text(money(doc.subtotal ?? 0), right, y, { align: 'right' });
  y += 6;
  if (Number(doc.tax_rate) > 0) {
    pdf.text(`Tax (${Number(doc.tax_rate)}%)`, totalsLeft, y);
    pdf.text(money(doc.tax_amount ?? 0), right, y, { align: 'right' });
    y += 6;
  }

  if (t.headerStyle === 'plain') {
    pdf.setDrawColor(...t.accent);
    pdf.setLineWidth(0.5);
    pdf.line(totalsLeft, y - 1, right, y - 1);
    pdf.setTextColor(...t.accent);
    y += 6;
  } else {
    pdf.setFillColor(...t.accent);
    pdf.rect(totalsLeft - 4, y - 5, right - totalsLeft + 4, 11, 'F');
    pdf.setTextColor(255, 255, 255);
    y += 2;
  }
  pdf.setFont(t.font, 'bold');
  pdf.setFontSize(12);
  pdf.text('TOTAL', totalsLeft, y);
  pdf.text(money(doc.total_amount ?? 0), right - 3, y, { align: 'right' });

  // ---------- Notes ----------
  if (doc.notes) {
    y += 18;
    if (y > 255) {
      pdf.addPage();
      y = MARGIN + 10;
    }
    pdf.setTextColor(...t.ink);
    pdf.setFont(t.font, 'bold');
    pdf.setFontSize(9);
    pdf.text('NOTES', left, y);
    pdf.setFont(t.font, 'normal');
    const notes = pdf.splitTextToSize(String(doc.notes), right - left);
    pdf.text(notes, left, y + 5);
  }

  // ---------- Footer ----------
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont(t.font, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 160);
    pdf.text(
      `${doc.company_name || ''} · ${title} ${doc.number || ''}`.trim(),
      left,
      288,
    );
    pdf.text(`Page ${p} of ${pages}`, right, 288, { align: 'right' });
  }

  return pdf;
}
