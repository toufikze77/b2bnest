// Phase 30: a small, safe Markdown reader for AI-drafted documents. It turns text into plain data (blocks of inline
// pieces); the screen, the PDF and the Word file are all built from that data. Nothing is ever turned into HTML, so a
// "<script>" or "<img onerror>" in the text stays text.

export interface Inline { text: string; bold?: boolean; italic?: boolean; placeholder?: boolean }
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  /** A numbered clause such as "1." or "2.3": the number is kept as written (Markdown would renumber it). */
  | { type: 'clause'; number: string; depth: number; inlines: Inline[] }
  | { type: 'bullet'; inlines: Inline[] }
  | { type: 'quote'; inlines: Inline[] }
  /** Phase 30d: a Markdown table (cookie lists, retention schedules). header is null when there is no |---| row. */
  | { type: 'table'; header: Inline[][] | null; rows: Inline[][][] }
  | { type: 'rule' };

const cells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSeparator = (row: string[]) => row.length > 0 && row.every((c) => /^:?-{2,}:?$/.test(c));

function tableBlock(lines: string[]): Block {
  const rows = lines.map(cells);
  const sep = rows.findIndex(isSeparator);
  const header = sep === 1 ? rows[0] : null;
  const body = rows.filter((r, i) => !isSeparator(r) && !(header && i === 0));
  const width = Math.max(header?.length ?? 0, ...body.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => parseInline(r[i] ?? ''));
  return { type: 'table', header: header ? pad(header) : null, rows: body.map(pad) };
}

/** "[Company number]" and the like; not "[text](link)". */
const PLACEHOLDER = /\[[^[\]\n]{1,80}\](?!\()/g;

function splitPlaceholders(text: string, base: Omit<Inline, 'text'>): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ ...base, text: text.slice(last, i) });
    out.push({ ...base, text: m[0], placeholder: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ ...base, text: text.slice(last) });
  return out;
}

/** Bold (**x** or __x__), italic (*x* or _x_), links reduced to their text, and placeholders. */
export function parseInline(raw: string): Inline[] {
  const text = raw.replace(/\[([^\]\n]+)\]\(([^)\s]*)\)/g, '$1').replace(/`([^`]*)`/g, '$1');
  const out: Inline[] = [];
  const re = /(\*\*|__)(.+?)\1|(?<![*\w])\*(?!\s)([^*\n]+?)\*(?!\*)|(?<![_\w])_(?!\s)([^_\n]+?)_(?![_\w])/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(...splitPlaceholders(text.slice(last, i), {}));
    if (m[2] !== undefined) out.push(...splitPlaceholders(m[2], { bold: true }));
    else out.push(...splitPlaceholders(m[3] ?? m[4] ?? '', { italic: true }));
    last = i + m[0].length;
  }
  if (last < text.length) out.push(...splitPlaceholders(text.slice(last), {}));
  return out.filter((x) => x.text.length > 0);
}

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let table: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', inlines: parseInline(para.join(' ')) });
    if (table.length) blocks.push(tableBlock(table));
    para = [];
    table = [];
  };
  for (const rawLine of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || /^```/.test(line)) { flush(); continue; }
    let m: RegExpExecArray | null;
    if (line.startsWith('|')) {
      if (para.length) { const t = table; table = []; flush(); table = t; }
      table.push(line);
      continue;
    }
    if (table.length) flush();
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'heading', level: Math.min(m[1].length, 4) as 1 | 2 | 3 | 4, inlines: parseInline(m[2].replace(/\s*#+\s*$/, '')) });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush(); blocks.push({ type: 'rule' });
    } else if ((m = /^(\d+(?:\.\d+)*)(\.|\))?\s+(.*)$/.exec(line)) && (m[2] || m[1].includes('.'))) {
      flush();
      blocks.push({ type: 'clause', number: m[1] + (m[2] === '.' ? '.' : m[2] ?? ''), depth: m[1].split('.').length - 1, inlines: parseInline(m[3]) });
    } else if ((m = /^\(?([a-z]|[ivx]+)\)\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'clause', number: `(${m[1]})`, depth: 2, inlines: parseInline(m[2]) });
    } else if ((m = /^[-*+•]\s+(.*)$/.exec(line))) {
      flush(); blocks.push({ type: 'bullet', inlines: parseInline(m[1]) });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flush(); blocks.push({ type: 'quote', inlines: parseInline(m[1]) });
    } else para.push(line);
  }
  flush();
  return blocks;
}

export const inlineText = (inlines: Inline[]) => inlines.map((i) => i.text).join('');

/** The placeholders still to fill in, in order, without repeats. */
export const placeholdersIn = (markdown: string) => [...new Set(markdown.match(PLACEHOLDER) ?? [])];
