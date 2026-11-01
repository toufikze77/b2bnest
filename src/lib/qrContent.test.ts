// Phase 29: real, deterministic QR codes; exact encoded strings; decoded back with jsQR (pure JS, no canvas needed).
import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import {
  colourWarning, encodeEmail, encodePhone, encodeSms, encodeVCard, encodeWhatsApp, encodeWifi, normaliseUrl, qrModules, renderError, renderSvg,
} from './qrContent';

const opts = { level: 'M' as const, size: 'small' as const, margin: 4, dark: '#000000', light: '#ffffff' };

/** Draws the module grid as RGBA pixels and decodes it, the way a phone camera would read the printed code. */
function decode(content: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): string | null {
  const m = qrModules(content, level);
  const scale = 4, quiet = 4, n = m.size, px = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * px + (x + quiet) * scale + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return jsQR(data, px, px)?.data ?? null;
}

describe('QR content', () => {
  it('URL: https:// added when missing; bad addresses refused', () => {
    expect(normaliseUrl('example.com/shop?a=1')).toEqual({ ok: true, value: 'https://example.com/shop?a=1' });
    expect(normaliseUrl('http://example.com')).toEqual({ ok: true, value: 'http://example.com' });
    expect(normaliseUrl('')).toMatchObject({ ok: false });
    expect(normaliseUrl('not a url')).toMatchObject({ ok: false });
    expect(normaliseUrl('ftp://example.com')).toMatchObject({ ok: false });
  });
  it('Email: mailto with encoded subject and body', () => {
    expect(encodeEmail('sam@example.com', 'Hi & bye', 'Line 1\nLine 2')).toEqual({ ok: true, value: 'mailto:sam@example.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202' });
    expect(encodeEmail('sam@example.com')).toEqual({ ok: true, value: 'mailto:sam@example.com' });
    expect(encodeEmail('nope')).toMatchObject({ ok: false });
  });
  it('Phone, SMS and WhatsApp', () => {
    expect(encodePhone('+44 7700 900-123')).toEqual({ ok: true, value: 'tel:+447700900123' });
    expect(encodeSms('07700 900123', 'Hello')).toEqual({ ok: true, value: 'SMSTO:07700900123:Hello' });
    expect(encodeWhatsApp('+44 7700 900123', 'Hi there & welcome')).toEqual({ ok: true, value: 'https://wa.me/447700900123?text=Hi%20there%20%26%20welcome' });
    expect(encodeWhatsApp('447700900123')).toEqual({ ok: true, value: 'https://wa.me/447700900123' });
    expect(encodeWhatsApp('123')).toMatchObject({ ok: false });
  });
  it('Wi-Fi: escapes \\ ; , : and " in the network name and password', () => {
    expect(encodeWifi('Café;Net', 'p@ss:w,o"r\\d', 'WPA', true)).toEqual({ ok: true, value: 'WIFI:T:WPA;S:Café\\;Net;P:p@ss\\:w\\,o\\"r\\\\d;H:true;;' });
    expect(encodeWifi('Guest', '', 'nopass')).toEqual({ ok: true, value: 'WIFI:T:nopass;S:Guest;;' });
    expect(encodeWifi('Guest', '', 'WPA')).toMatchObject({ ok: false });
  });
  it('Contact card: exact vCard 3.0 lines', () => {
    expect(encodeVCard({ firstName: 'Sam', lastName: 'Taylor', organisation: 'Taylor, Co; Ltd', jobTitle: 'Owner', phone: '+44 7700 900123', email: 'sam@example.com', website: 'example.com', note: 'Line 1\nLine 2' }))
      .toEqual({ ok: true, value: [
        'BEGIN:VCARD', 'VERSION:3.0', 'N:Taylor;Sam;;;', 'FN:Sam Taylor', 'ORG:Taylor\\, Co\\; Ltd', 'TITLE:Owner', 'TEL;TYPE=CELL:+447700900123',
        'EMAIL:sam@example.com', 'URL:https://example.com', 'NOTE:Line 1\\nLine 2', 'END:VCARD',
      ].join('\r\n') });
  });
  it('colour warnings: low contrast and inverted colours', () => {
    expect(colourWarning('#000000', '#ffffff')).toBeNull();
    expect(colourWarning('#777777', '#888888')).toMatch(/too close/);
    expect(colourWarning('#ffffff', '#000000')).toMatch(/Light code on a dark background/);
  });
});

describe('real QR codes', () => {
  it('the same input gives the same code twice (no randomness)', async () => {
    expect(await renderSvg('https://example.com', opts)).toBe(await renderSvg('https://example.com', opts));
  });
  it.each([
    'https://example.com/shop?a=1',
    'WIFI:T:WPA;S:Café\\;Net;P:p@ss\\:w;;',
    'https://wa.me/447700900123?text=Hi',
    ['BEGIN:VCARD', 'VERSION:3.0', 'N:Taylor;Sam;;;', 'FN:Sam Taylor', 'END:VCARD'].join('\r\n'),
  ])('decodes back to exactly what was encoded: %s', (content) => {
    expect(decode(content)).toBe(content);
  });
  it('an over-long input is refused with a clear message', async () => {
    const opts2 = { ...opts, level: 'H' as const };
    const tooLong = 'x'.repeat(3000);
    let message = '';
    try { await renderSvg(tooLong, opts2); } catch (e) { message = renderError(e, 'H'); }
    expect(message).toMatch(/^Too much content for a QR code at error correction H\. Shorten it, or choose a lower level/);
  });
});
