import jsPDF from 'jspdf';
import { Template } from '@/types/template';

/**
 * Generates a real, downloadable file for a template.
 * Document-style templates become branded PDFs, spreadsheet/board-style
 * templates become CSV boards that open in Excel / Google Sheets.
 */

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Board columns used for spreadsheet-style templates. */
const boardColumns = ['Item', 'Owner', 'Status', 'Priority', 'Due date', 'Notes'];

const boardRows = (template: Template): string[][] => {
  const statuses = ['Working on it', 'Done', 'Stuck', 'Not started'];
  const priorities = ['High', 'Medium', 'Low'];
  const base = template.category.subcategories.length
    ? template.category.subcategories
    : template.tags;
  const items = (base.length ? base : ['Task']).slice(0, 8);
  return items.map((item, i) => [
    `${item} — step ${i + 1}`,
    '',
    statuses[i % statuses.length],
    priorities[i % priorities.length],
    '',
    '',
  ]);
};

const toCsv = (rows: string[][]) =>
  rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

const generateCsv = (template: Template) => {
  const rows: string[][] = [
    [template.title],
    [template.description],
    [`Provided by B2BNest · ${template.author} · v${template.version}`],
    [],
    boardColumns,
    ...boardRows(template),
  ];
  triggerDownload(
    new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' }),
    `${slug(template.title)}.csv`,
  );
};

const generatePdf = (template: Template) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  // Header band
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(doc.splitTextToSize(template.title, pageW - margin * 2), margin, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${template.category.name}${template.subcategory ? ' · ' + template.subcategory : ''}`, margin, 76);
  doc.text('B2BNest Template Center', pageW - margin, 76, { align: 'right' });

  y = 132;
  doc.setTextColor(30, 41, 59);

  const section = (title: string) => {
    if (y > pageH - 120) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
  };

  const paragraph = (text: string) => {
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    lines.forEach((line: string) => {
      if (y > pageH - 60) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });
    y += 10;
  };

  section('Overview');
  paragraph(template.description);

  section('How to use this template');
  paragraph(
    template.instructions ??
      'Replace every highlighted placeholder with your own business details, then review the document with your team before use.',
  );

  section('Template details');
  const details = [
    ['Author', template.author],
    ['Version', template.version],
    ['Last updated', template.lastUpdated],
    ['Licence', `${template.license.name} (${template.license.type})`],
    ['Commercial use', template.commercialUse ? 'Permitted' : 'Not permitted'],
    ['Resale rights', template.canResell ? 'Permitted' : 'Not permitted'],
    ['Difficulty', template.difficulty],
    ['Tags', template.tags.join(', ')],
  ];
  details.forEach(([k, v]) => {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(v), pageW - margin * 2 - 110);
    doc.text(lines, margin + 110, y);
    y += 16 * lines.length;
  });
  y += 14;

  section('Working sections');
  const rows = boardRows(template);
  rows.forEach(([item]) => {
    if (y > pageH - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y - 9, 12, 12);
    doc.text(item, margin + 22, y);
    y += 24;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin + 22, y - 12, pageW - margin, y - 12);
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`b2bnest.online · ${template.title}`, margin, pageH - 24);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 24, { align: 'right' });
  }

  doc.save(`${slug(template.title)}.pdf`);
};

export const downloadTemplate = (template: Template) => {
  if (template.fileType === 'XLSX') generateCsv(template);
  else generatePdf(template);
  return template.fileType === 'XLSX' ? 'CSV' : 'PDF';
};
