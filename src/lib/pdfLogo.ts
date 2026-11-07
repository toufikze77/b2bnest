// The company logo for quote/invoice PDFs: fetched once, checked, and turned into a data URL jsPDF can draw.
// PNG and JPEG are used as they are; WebP and GIF are redrawn as PNG through a canvas. Anything that can't be loaded
// (network, wrong type, too large, no canvas) gives null, and the PDF is made without a logo.

export interface PdfLogo { dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number }

/** The same limit as the logo upload (5 MB). */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
/** The logo box at the top left of the page, in mm. */
export const LOGO_BOX = { width: 40, height: 18 } as const;

type Kind = 'png' | 'jpeg' | 'gif' | 'webp';

export function sniffImage(b: Uint8Array): Kind | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 6 && String.fromCharCode(...b.subarray(0, 4)) === 'GIF8') return 'gif';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'webp';
  return null;
}

/** Pixel size from the file header (PNG IHDR, JPEG SOFn), or null if it can't be read. */
export function imageSize(b: Uint8Array, kind: 'png' | 'jpeg'): { width: number; height: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (kind === 'png') {
    if (b.length < 24) return null;
    const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const width = u32(16); const height = u32(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = u16(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16(i + 5); const width = u16(i + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/** The logo's size on the page: as large as fits the box, aspect ratio kept (never stretched). */
export function fitLogo(width: number, height: number, box: { width: number; height: number } = LOGO_BOX): { w: number; h: number } {
  const scale = Math.min(box.width / width, box.height / height);
  return { w: width * scale, h: height * scale };
}

function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** WebP/GIF to PNG through a canvas (in the browser). Null where there is no canvas or the image won't decode. */
export async function redrawAsPng(bytes: Uint8Array, mime: string): Promise<PdfLogo | null> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const width = img.naturalWidth; const height = img.naturalHeight;
    if (!width || !height) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.startsWith('data:image/png') ? { dataUrl, format: 'PNG', width, height } : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface LoadLogoOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  redraw?: (bytes: Uint8Array, mime: string) => Promise<PdfLogo | null>;
}

/** Never throws: null means "make the PDF without a logo". */
export async function loadPdfLogo(url: string | null | undefined, opts: LoadLogoOptions = {}): Promise<PdfLogo | null> {
  if (typeof url !== 'string' || !url.trim()) return null;
  const { fetchImpl = globalThis.fetch, timeoutMs = 10_000, maxBytes = LOGO_MAX_BYTES, redraw = redrawAsPng } = opts;
  if (typeof fetchImpl !== 'function') return null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url.trim(), ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    const declared = Number(res.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) return null;
    const kind = sniffImage(bytes);
    if (kind === 'png' || kind === 'jpeg') {
      const size = imageSize(bytes, kind);
      if (!size) return null;
      return { dataUrl: `data:image/${kind};base64,${toBase64(bytes)}`, format: kind === 'png' ? 'PNG' : 'JPEG', ...size };
    }
    if (kind === 'gif' || kind === 'webp') return await redraw(bytes, `image/${kind}`);
    return null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
