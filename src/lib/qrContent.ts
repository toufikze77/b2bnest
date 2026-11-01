// Phase 29: what goes inside a QR code, and the real QR code itself (the `qrcode` library; nothing is random and nothing
// is sent to a server). The old generator drew random squares that could never be scanned.
import QRCode from 'qrcode';

export type QrType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'whatsapp' | 'wifi' | 'vcard';
export type QrLevel = 'L' | 'M' | 'Q' | 'H';
export type QrSize = 'small' | 'medium' | 'large';
export const QR_SIZES: Record<QrSize, number> = { small: 200, medium: 300, large: 500 };

export type Built = { ok: true; value: string } | { ok: false; error: string };
const fail = (error: string): Built => ({ ok: false, error });
const ok = (value: string): Built => ({ ok: true, value });

/** Adds https:// when missing and checks it is a real web address. */
export function normaliseUrl(input: string): Built {
  const raw = input.trim();
  if (!raw) return fail('Enter a web address.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fail('Use a web address starting with http:// or https://.');
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return fail('That is not a complete web address (for example example.com).');
    return ok(withScheme);
  } catch {
    return fail('That is not a valid web address.');
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function encodeEmail(to: string, subject = '', body = ''): Built {
  const addr = to.trim();
  if (!EMAIL.test(addr)) return fail('Enter a valid email address.');
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
  return ok(`mailto:${addr}${q ? `?${q}` : ''}`);
}

/** Keeps a leading + and the digits. */
export const cleanPhone = (n: string) => (n.trim().startsWith('+') ? '+' : '') + n.replace(/\D/g, '');
const phoneOk = (n: string) => /^\+?\d{5,15}$/.test(n);

export function encodePhone(number: string): Built {
  const n = cleanPhone(number);
  return phoneOk(n) ? ok(`tel:${n}`) : fail('Enter a phone number (5 to 15 digits, + for the country code).');
}
export function encodeSms(number: string, message = ''): Built {
  const n = cleanPhone(number);
  return phoneOk(n) ? ok(`SMSTO:${n}:${message}`) : fail('Enter a phone number (5 to 15 digits, + for the country code).');
}
/** https://wa.me/<digits>[?text=…]: WhatsApp wants the full international number, digits only. */
export function encodeWhatsApp(number: string, message = ''): Built {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return fail('Enter the full international number, for example 447700900123.');
  return ok(`https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`);
}

/** Wi-Fi strings escape \ ; , : and " with a backslash. */
export const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
export function encodeWifi(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass', hidden = false): Built {
  if (!ssid) return fail('Enter the network name (SSID).');
  if (security !== 'nopass' && !password) return fail('Enter the Wi-Fi password, or choose "No password".');
  const parts = [`T:${security}`, `S:${wifiEscape(ssid)}`];
  if (security !== 'nopass') parts.push(`P:${wifiEscape(password)}`);
  if (hidden) parts.push('H:true');
  return ok(`WIFI:${parts.join(';')};;`);
}

export interface VCardInput { firstName: string; lastName: string; organisation?: string; jobTitle?: string; phone?: string; email?: string; website?: string; note?: string }
/** vCard text values escape \ , ; and new lines. */
export const vcardEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
export function encodeVCard(v: VCardInput): Built {
  const first = v.firstName.trim();
  const last = v.lastName.trim();
  if (!first && !last) return fail('Enter a first or last name.');
  if (v.email?.trim() && !EMAIL.test(v.email.trim())) return fail('Enter a valid email address, or leave it empty.');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vcardEscape(last)};${vcardEscape(first)};;;`, `FN:${vcardEscape([first, last].filter(Boolean).join(' '))}`];
  if (v.organisation?.trim()) lines.push(`ORG:${vcardEscape(v.organisation.trim())}`);
  if (v.jobTitle?.trim()) lines.push(`TITLE:${vcardEscape(v.jobTitle.trim())}`);
  if (v.phone?.trim()) lines.push(`TEL;TYPE=CELL:${cleanPhone(v.phone)}`);
  if (v.email?.trim()) lines.push(`EMAIL:${v.email.trim()}`);
  if (v.website?.trim()) {
    const u = normaliseUrl(v.website);
    if (!u.ok) return u;
    lines.push(`URL:${u.value}`);
  }
  if (v.note?.trim()) lines.push(`NOTE:${vcardEscape(v.note.trim())}`);
  lines.push('END:VCARD');
  return ok(lines.join('\r\n'));
}

export function encodeText(text: string): Built {
  return text.trim() ? ok(text) : fail('Enter some text.');
}

// ---- Colours ----
const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]: [number, number, number]) => {
  const c = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export function contrastRatio(fg: string, bg: string): number {
  const a = hexToRgb(fg); const b = hexToRgb(bg);
  if (!a || !b) return 1;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** A warning when the colours may not scan: too little contrast, or light code on a dark background. */
export function colourWarning(fg: string, bg: string): string | null {
  const a = hexToRgb(fg); const b = hexToRgb(bg);
  if (!a || !b) return 'Use colours like #000000.';
  if (contrastRatio(fg, bg) < 4) return 'The colours are too close: many phones will not scan this. Use a dark code on a light background.';
  if (luminance(a) > luminance(b)) return 'Light code on a dark background: some phones will not scan this. Use a dark code on a light background.';
  return null;
}

// ---- Rendering ----
export interface RenderOptions { level: QrLevel; size: QrSize; margin: number; dark: string; light: string }
const qrOptions = (o: RenderOptions) => ({ errorCorrectionLevel: o.level, margin: o.margin, width: QR_SIZES[o.size], color: { dark: o.dark, light: o.light } });

/** The library's own refusal in plain words (too much content for the chosen level). */
export function renderError(e: unknown, level: QrLevel): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/too big|amount of data/i.test(msg)) {
    return `Too much content for a QR code at error correction ${level}. Shorten it${level === 'L' ? '' : ', or choose a lower level (L holds the most)'}.`;
  }
  return `The QR code could not be made: ${msg}`;
}

export const renderSvg = (content: string, o: RenderOptions) => QRCode.toString(content, { ...qrOptions(o), type: 'svg' });
export const renderPng = (content: string, o: RenderOptions) => QRCode.toDataURL(content, { ...qrOptions(o), type: 'image/png' });
/** The module grid only (used by the tests to decode a code back). */
export const qrModules = (content: string, level: QrLevel) => QRCode.create(content, { errorCorrectionLevel: level }).modules;

export const fileBase = (type: QrType) => `qr-${type}`;
