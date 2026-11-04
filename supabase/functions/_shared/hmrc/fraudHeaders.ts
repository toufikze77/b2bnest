// HMRC P2: fraud prevention headers for the WEB_APP_VIA_SERVER connection method, built exactly as HMRC's
// specification describes (Developer Hub → Fraud prevention → "Web application via server", spec version 3.3 of
// 27 January 2025, and "Getting it right" for the key-value and list encodings). Read on 4 Nov 2026.
//
// Rules from the spec that this file follows:
//   * US-ASCII only, other characters percent encoded. Key-value: <key>=<value>&… List: <value>,<value>,…
//     Keys and values percent encoded; separators (= & ,) never encoded.
//   * Missing data: never a placeholder (no "null", "undefined"); a header we can't fill is left out and listed in
//     `omitted`, so it can be explained to HMRC (the spec: you must contact HMRC about a value you cannot collect).
// Nothing here ever holds an email address, a name, a token or a secret.

export const CONNECTION_METHOD = 'WEB_APP_VIA_SERVER';
export const VENDOR_PRODUCT_NAME = 'B2BNEST';
/** Our own software version labels (Gov-Vendor-Version needs the client and the server for client-server apps). */
export const SERVER_SOFTWARE = { name: 'b2bnest-server', version: '1.0.0' } as const;

/** Every header for this connection method, in the spec's order. */
export const WEB_APP_VIA_SERVER_HEADERS = [
  'Gov-Client-Connection-Method', 'Gov-Client-Browser-JS-User-Agent', 'Gov-Client-Device-ID', 'Gov-Client-Multi-Factor',
  'Gov-Client-Public-IP', 'Gov-Client-Public-IP-Timestamp', 'Gov-Client-Public-Port', 'Gov-Client-Screens', 'Gov-Client-Timezone',
  'Gov-Client-User-IDs', 'Gov-Client-Window-Size', 'Gov-Vendor-Forwarded', 'Gov-Vendor-License-IDs', 'Gov-Vendor-Product-Name',
  'Gov-Vendor-Public-IP', 'Gov-Vendor-Version',
] as const;
export type FraudHeaderName = typeof WEB_APP_VIA_SERVER_HEADERS[number];

/** Percent encoding (RFC 3986): everything except A-Z a-z 0-9 - . _ ~ */
export const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/** US-ASCII printable as is; anything else percent encoded (for values the spec says to pass "as reported"). */
export const asciiOnly = (s: string) => s.replace(/[^\x20-\x7e]/g, (c) => encodeURIComponent(c)).trim();
const kv = (pairs: [string, string][]) => pairs.map(([k, v]) => `${pct(k)}=${pct(v)}`).join('&');

// ------------------------------------------------------------------ what the browser sends (validated here)
export interface BrowserScreen { width: number; height: number; scalingFactor: number; colourDepth: number }
export interface BrowserFraudData {
  deviceId: string;
  jsUserAgent: string;
  screens: BrowserScreen[];
  windowSize: { width: number; height: number };
  timezone: string;
  /** The web app's version label (for Gov-Vendor-Version). */
  webVersion: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const posInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 100000;
const posNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 100;
export const TIMEZONE = /^UTC[+-](0\d|1[0-4]):[0-5]\d$/;

/** Keeps only the fields the spec lists, each checked; anything wrong is dropped (and the header later omitted). */
export function readBrowserFraudData(raw: unknown): Partial<BrowserFraudData> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<BrowserFraudData> = {};
  if (typeof r.deviceId === 'string' && UUID.test(r.deviceId)) out.deviceId = r.deviceId.toLowerCase();
  if (typeof r.jsUserAgent === 'string' && r.jsUserAgent.trim() && r.jsUserAgent.length <= 1024) out.jsUserAgent = r.jsUserAgent;
  if (Array.isArray(r.screens)) {
    const screens = r.screens.slice(0, 8).filter((s): s is BrowserScreen => !!s && typeof s === 'object'
      && posInt((s as BrowserScreen).width) && posInt((s as BrowserScreen).height) && posNum((s as BrowserScreen).scalingFactor) && posInt((s as BrowserScreen).colourDepth));
    if (screens.length) out.screens = screens.map((s) => ({ width: s.width, height: s.height, scalingFactor: s.scalingFactor, colourDepth: s.colourDepth }));
  }
  const w = r.windowSize as { width?: unknown; height?: unknown } | undefined;
  if (w && posInt(w.width) && posInt(w.height)) out.windowSize = { width: w.width, height: w.height };
  if (typeof r.timezone === 'string' && TIMEZONE.test(r.timezone)) out.timezone = r.timezone;
  if (typeof r.webVersion === 'string' && /^[0-9A-Za-z.+-]{1,40}$/.test(r.webVersion)) out.webVersion = r.webVersion;
  return out;
}

// ------------------------------------------------------------------ what only the server knows
export interface ServerFraudData {
  /** The person's public IP as seen by our edge (null when it can't be read reliably). */
  clientPublicIp: string | null;
  /** When the request reached the server. */
  receivedAt: Date;
  /** The public TCP port of the person's device (null: not available to Supabase Edge Functions; see the README). */
  clientPublicPort: number | null;
  /** The public IP the person's browser sent the request to (HMRC_VENDOR_PUBLIC_IP; null when not configured). */
  vendorPublicIp: string | null;
  /** A stable internal identifier (the B2BNEST user id), never an email address or name. */
  userId: string;
  /** Only when the person entered their authenticator code in this session (aal2). */
  mfa: { type: 'TOTP'; at: Date; uniqueReference: string } | null;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
function isPublicIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
}
/** A public IPv4 or IPv6 address (private, loopback, link-local and unique-local ranges are not public). */
export function publicIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim().replace(/^\[|\]$/g, '');
  if (/^::ffff:/i.test(ip) && IPV4.test(ip.slice(7))) ip = ip.slice(7);
  if (IPV4.test(ip)) return isPublicIpv4(ip) ? ip : null;
  if (ip.includes(':') && IPV6.test(ip) && ip.split(':').length <= 8) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l)) return null;
    return ip;
  }
  return null;
}

/**
 * The person's public IP from the request, as Supabase's edge passes it on. Relies on X-Forwarded-For (first entry is
 * the original client), then CF-Connecting-IP, then X-Real-IP; only a valid public address is used, otherwise null
 * (left out, never invented). How hosted Supabase fills these is not documented: confirm with HMRC's header test.
 */
export function clientIpFrom(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = publicIp(xff.split(',')[0]);
    if (first) return first;
  }
  return publicIp(headers.get('cf-connecting-ip')) ?? publicIp(headers.get('x-real-ip'));
}

// ------------------------------------------------------------------ the header set
export interface FraudHeaderResult { headers: Record<string, string>; omitted: FraudHeaderName[] }

export function buildFraudHeaders(browser: Partial<BrowserFraudData>, server: ServerFraudData): FraudHeaderResult {
  const h: Partial<Record<FraudHeaderName, string>> = {};
  h['Gov-Client-Connection-Method'] = CONNECTION_METHOD;
  if (browser.jsUserAgent) h['Gov-Client-Browser-JS-User-Agent'] = asciiOnly(browser.jsUserAgent);
  if (browser.deviceId) h['Gov-Client-Device-ID'] = browser.deviceId;
  if (server.mfa) {
    h['Gov-Client-Multi-Factor'] = kv([['type', server.mfa.type], ['timestamp', server.mfa.at.toISOString()], ['unique-reference', server.mfa.uniqueReference]]);
  }
  const clientIp = publicIp(server.clientPublicIp);
  if (clientIp) {
    h['Gov-Client-Public-IP'] = clientIp;
    h['Gov-Client-Public-IP-Timestamp'] = server.receivedAt.toISOString(); // yyyy-MM-ddThh:mm:ss.sssZ
  }
  const port = server.clientPublicPort;
  if (port && Number.isInteger(port) && port >= 1 && port <= 65535 && port !== 80 && port !== 443) h['Gov-Client-Public-Port'] = String(port);
  if (browser.screens?.length) {
    h['Gov-Client-Screens'] = browser.screens.map((s) => kv([['width', String(s.width)], ['height', String(s.height)],
      ['scaling-factor', String(s.scalingFactor)], ['colour-depth', String(s.colourDepth)]])).join(',');
  }
  if (browser.timezone && TIMEZONE.test(browser.timezone)) h['Gov-Client-Timezone'] = browser.timezone;
  if (server.userId && UUID.test(server.userId)) h['Gov-Client-User-IDs'] = kv([['b2bnest', server.userId]]);
  if (browser.windowSize) h['Gov-Client-Window-Size'] = kv([['width', String(browser.windowSize.width)], ['height', String(browser.windowSize.height)]]);
  const vendorIp = publicIp(server.vendorPublicIp);
  if (vendorIp) h['Gov-Vendor-Public-IP'] = vendorIp;
  if (vendorIp && clientIp) h['Gov-Vendor-Forwarded'] = kv([['by', vendorIp], ['for', clientIp]]);
  // Gov-Vendor-License-IDs: B2BNEST puts no licence on the person's device, so there is no value to send (the spec:
  // "If there are no licenses on the originating device, you will not be able to collect a value").
  h['Gov-Vendor-Product-Name'] = pct(VENDOR_PRODUCT_NAME);
  const versions: [string, string][] = [];
  if (browser.webVersion) versions.push(['b2bnest-web', browser.webVersion]);
  versions.push([SERVER_SOFTWARE.name, SERVER_SOFTWARE.version]);
  h['Gov-Vendor-Version'] = kv(versions);

  const headers: Record<string, string> = {};
  for (const name of WEB_APP_VIA_SERVER_HEADERS) {
    const v = h[name];
    if (typeof v === 'string' && v !== '' && /^[\x20-\x7e]+$/.test(v)) headers[name] = v;
  }
  return { headers, omitted: WEB_APP_VIA_SERVER_HEADERS.filter((n) => !(n in headers)) };
}
