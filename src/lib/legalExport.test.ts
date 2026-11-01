import { describe, expect, it } from 'vitest';
import { buildDocx, buildPdf, markdownBlob } from '@/lib/legalExport';

const DOC = `# Service Agreement\n\n1. **Definitions**\n1.1 ${'The Supplier shall provide the Services to the Client with reasonable skill and care. '.repeat(60)}\n- Fee: £2,500 [Fee]\n\nThis document was drafted with AI from the details provided. It is not legal advice.`;

// jsdom's Blob has no stream(); FileReader works in every environment.
const bytes = (b: Blob) => new Promise<Uint8Array>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(b);
});

describe('exports', () => {
  it('PDF is a non-empty PDF file over more than one page', async () => {
    const blob = await buildPdf(DOC, 'Service Agreement');
    const b = await bytes(blob);
    expect(b.length).toBeGreaterThan(1000);
    const text = new TextDecoder('latin1').decode(b);
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toContain('Page 1 of');
  });

  it('Word file is a non-empty .docx (zip)', async () => {
    const b = await bytes(await buildDocx(DOC, 'Service Agreement'));
    expect(b.length).toBeGreaterThan(1000);
    expect([b[0], b[1]]).toEqual([0x50, 0x4b]); // "PK"
  });

  it('Markdown is the text as is', async () => {
    expect(new TextDecoder().decode(await bytes(markdownBlob(DOC)))).toBe(DOC);
  });
});
