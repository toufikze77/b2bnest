// HMRC P0: token encryption. AES-256-GCM with a random 96-bit IV per value; the key (HMRC_TOKEN_KEY) exists only in the
// Edge Functions. Stored format: "v1.<key id>.<iv>.<ciphertext+tag>" (base64url). The key id is derived from the key, so
// a later rotation can keep old keys by id. The additional data binds each value to its company, environment and field,
// so a ciphertext copied to another company's row does not decrypt.
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

export async function keyId(key: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', key));
  return b64url(digest).slice(0, 12);
}
export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const tokenAad = (companyId: string, environment: string, field: 'access' | 'refresh') => `hmrc:${companyId}:${environment}:${field}`;

const importKey = (key: Uint8Array) => crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

export async function encryptToken(plain: string, key: Uint8Array, aad: string): Promise<string> {
  if (key.length !== 32) throw new Error('bad key');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, await importKey(key), enc.encode(plain)));
  return `v1.${await keyId(key)}.${b64url(iv)}.${b64url(ct)}`;
}

export class TokenDecryptError extends Error {
  constructor(public readonly reason: 'format' | 'unknown_key' | 'tampered') { super(`token decrypt failed: ${reason}`); }
}

/** keyring: key id → key. Today it holds HMRC_TOKEN_KEY only; a rotation adds the previous key here. */
export async function decryptToken(stored: string, keyring: Map<string, Uint8Array>, aad: string): Promise<string> {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new TokenDecryptError('format');
  const key = keyring.get(parts[1]);
  if (!key) throw new TokenDecryptError('unknown_key');
  try {
    const iv = fromB64url(parts[2]);
    if (iv.length !== 12) throw new Error('iv');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, await importKey(key), fromB64url(parts[3]));
    return dec.decode(pt);
  } catch {
    throw new TokenDecryptError('tampered');
  }
}

export async function keyringFrom(...keys: (Uint8Array | null | undefined)[]): Promise<Map<string, Uint8Array>> {
  const ring = new Map<string, Uint8Array>();
  for (const k of keys) if (k) ring.set(await keyId(k), k);
  return ring;
}

/** A random, URL-safe sign-in state (32 bytes). Only its SHA-256 hash is stored. */
export const newState = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
