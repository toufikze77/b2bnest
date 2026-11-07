// The company logo in quote/invoice PDFs: loaded first, drawn once in a 40 x 18 mm box, and never a reason to fail.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { fitLogo, imageSize, loadPdfLogo, sniffImage } from './pdfLogo';
import { drawDocumentPdf, renderDocumentPdf, type RenderableDocument } from './documentTemplates';

// A real 1 x 1 PNG (so jsPDF can embed it).
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const png = () => Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
// The start of a JPEG: SOI, an APP0 segment, then SOF0 with height 120 and width 300.
const jpegHead = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x78, 0x01, 0x2c, 0x03, 0, 0, 0, 0, 0, 0]);
const gif = () => new TextEncoder().encode('GIF89a\u0001\u0000\u0001\u0000');

const answer = (bytes: Uint8Array, status = 200) => vi.fn(async () => ({
  ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-length': String(bytes.length) }),
  arrayBuffer: async () => bytes.slice().buffer,
})) as unknown as typeof fetch;

const doc: RenderableDocument = {
  type: 'invoice', number: 'INV-7', company_name: 'Acme Trading Ltd', company_address: '1 High St\nLondon', client_name: 'Priya Shah',
  items: [{ description: 'Work', quantity: 1, rate: 100, amount: 100 }], subtotal: 100, tax_rate: 20, tax_amount: 20, total_amount: 120,
};

afterEach(() => vi.restoreAllMocks());

describe('loading the logo', () => {
  it('reads PNG and JPEG sizes from the file, and knows GIF and WebP', () => {
    expect(sniffImage(png())).toBe('png');
    expect(imageSize(png(), 'png')).toEqual({ width: 1, height: 1 });
    expect(sniffImage(jpegHead())).toBe('jpeg');
    expect(imageSize(jpegHead(), 'jpeg')).toEqual({ width: 300, height: 120 });
    expect(sniffImage(gif())).toBe('gif');
    expect(sniffImage(new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('webp');
    expect(sniffImage(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('fits the 40 x 18 mm box with the aspect ratio kept', () => {
    expect(fitLogo(300, 120)).toEqual({ w: 40, h: 16 }); // wide: limited by the width
    expect(fitLogo(100, 100)).toEqual({ w: 18, h: 18 }); // square: limited by the height
    const tall = fitLogo(50, 200);
    expect(tall.h).toBe(18); expect(tall.w).toBeCloseTo(4.5);
  });

  it('a PNG becomes a data URL with its size', async () => {
    const logo = await loadPdfLogo('https://cdn.test/logo.png', { fetchImpl: answer(png()) });
    expect(logo).toEqual({ dataUrl: `data:image/png;base64,${PNG_B64}`, format: 'PNG', width: 1, height: 1 });
  });

  it('GIF and WebP go through the canvas redraw', async () => {
    const redraw = vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AAAA', format: 'PNG' as const, width: 2, height: 1 }));
    expect(await loadPdfLogo('https://cdn.test/logo.gif', { fetchImpl: answer(gif()), redraw })).toMatchObject({ format: 'PNG', width: 2 });
    expect(redraw).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/gif');
  });

  it('network error, error status, wrong type, too large, or no URL: null, never a throw', async () => {
    const broken = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await loadPdfLogo('https://cdn.test/logo.png', { fetchImpl: broken })).toBeNull();
    expect(await loadPdfLogo('https://cdn.test/logo.png', { fetchImpl: answer(png(), 404) })).toBeNull();
    expect(await loadPdfLogo('https://cdn.test/logo.png', { fetchImpl: answer(new TextEncoder().encode('<html>not an image</html>')) })).toBeNull();
    expect(await loadPdfLogo('https://cdn.test/logo.png', { fetchImpl: answer(png()), maxBytes: 10 })).toBeNull();
    const unused = answer(png());
    expect(await loadPdfLogo('', { fetchImpl: unused })).toBeNull();
    expect(await loadPdfLogo(null, { fetchImpl: unused })).toBeNull();
    expect(unused).not.toHaveBeenCalled();
  });
});

describe('the PDF', () => {
  // Where the company name was drawn, in mm from the top (read back from the PDF's own text commands).
  const companyNameY = (pdf: jsPDF) => {
    const m = /([\d.]+) ([\d.]+) Td\n\(Acme Trading Ltd\) Tj/.exec(pdf.output())!;
    return Math.round((297 - (Number(m[2]) * 25.4) / 72) * 100) / 100;
  };

  it('with a logo: addImage once, top left inside the box, the company name moved below it', async () => {
    const addImage = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage');
    const pdf = await renderDocumentPdf({ ...doc, logo_url: 'https://cdn.test/logo.png' }, 'classic', 'GBP', { fetchImpl: answer(png()) });
    expect(addImage).toHaveBeenCalledTimes(1);
    const [data, format, x, y, w, h] = addImage.mock.calls[0] as unknown as [string, string, number, number, number, number];
    expect(data).toMatch(/^data:image\/png;base64,/);
    expect(format).toBe('PNG');
    expect([x, y, w, h]).toEqual([18, 8, 18, 18]);
    expect(companyNameY(pdf) - 5).toBeGreaterThan(y + h); // the name's top (about 5 mm above its baseline) stays clear of the logo
    expect(new TextDecoder().decode(pdf.output('arraybuffer')).startsWith('%PDF-')).toBe(true);
  });

  it('the image can\'t be loaded: still a PDF, no logo, layout unchanged, no throw', async () => {
    const addImage = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage');
    const broken = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const pdf = await renderDocumentPdf({ ...doc, logo_url: 'https://cdn.test/gone.png' }, 'modern', 'GBP', { fetchImpl: broken });
    expect(addImage).not.toHaveBeenCalled();
    expect(companyNameY(pdf)).toBe(18);
    expect(new TextDecoder().decode(pdf.output('arraybuffer')).startsWith('%PDF-')).toBe(true);
  });

  it('without a logo nothing changes: nothing fetched, no image, the header where it always was', async () => {
    const addImage = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage');
    const fetchImpl = answer(png());
    const pdf = await renderDocumentPdf(doc, 'classic', 'GBP', { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(addImage).not.toHaveBeenCalled();
    expect(companyNameY(pdf)).toBe(24);
    expect(companyNameY(drawDocumentPdf(doc, 'modern'))).toBe(18);
  });
});
