import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, placeholdersIn } from '@/lib/legalMarkdown';

describe('parseMarkdown', () => {
  it('headings, numbered clauses kept as written, bullets, paragraphs', () => {
    const blocks = parseMarkdown('# Service Agreement\n\n## What this document does\nIt sets out terms.\n\n1. **Definitions**\n1.1 "Services" means the work.\n- a bullet\n---\nLast line.');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'heading', 'paragraph', 'clause', 'clause', 'bullet', 'rule', 'paragraph']);
    expect(blocks[3]).toMatchObject({ type: 'clause', number: '1.', depth: 0, inlines: [{ text: 'Definitions', bold: true }] });
    expect(blocks[4]).toMatchObject({ type: 'clause', number: '1.1', depth: 1 });
  });

  it('placeholders are marked, links are reduced to text', () => {
    expect(parseInline('Company number [Company number], see [site](https://x.y).')).toEqual([
      { text: 'Company number ' }, { text: '[Company number]', placeholder: true }, { text: ', see site.' },
    ]);
    expect(parseInline('**Fee: [Fee]**')).toEqual([{ text: 'Fee: ', bold: true }, { text: '[Fee]', bold: true, placeholder: true }]);
    expect(placeholdersIn('[A] and [B] and [A]')).toEqual(['[A]', '[B]']);
  });
});
