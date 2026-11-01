// Phase 24: the security headers Vercel sends on every route (vercel.json).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const all = config.headers.find((h) => h.source === '/(.*)')!;
const header = (k: string) => all.headers.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;
const csp = Object.fromEntries((header('Content-Security-Policy') ?? '').split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => { const [name, ...v] = d.split(/\s+/); return [name, v]; }));

describe('vercel.json security headers', () => {
  it('keeps the existing two', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
  it('adds HSTS, clickjacking protection and Permissions-Policy', () => {
    expect(header('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  });
  it('ships an enforced CSP', () => {
    expect(header('Content-Security-Policy')).toBeTruthy();
    expect(header('Content-Security-Policy-Report-Only')).toBeUndefined();
  });
  it('the CSP is locked down where it must be', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    for (const v of Object.values(csp).flat()) expect(v).not.toMatch(/unsafe-eval|^\*$/);
  });
  it('allows the Supabase project over HTTPS and WebSocket, and Google Fonts', () => {
    expect(csp['connect-src']).toEqual(expect.arrayContaining([
      'https://gvftvswyrevummbvyhxa.supabase.co', 'wss://gvftvswyrevummbvyhxa.supabase.co']));
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    expect(csp['font-src']).toContain('https://fonts.gstatic.com');
  });
  it('the Supabase origin matches the one the build uses (.env.production)', () => {
    const env = readFileSync(resolve(__dirname, '../../.env.production'), 'utf8');
    const url = /VITE_SUPABASE_URL\s*=\s*"?([^"\s]+)/.exec(env)?.[1];
    expect(url && csp['connect-src']).toContain(url!.replace(/\/$/, ''));
  });
});
