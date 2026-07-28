// HMAC-signed OAuth state tokens.
// Format: base64url(payload).base64url(hmac)
// payload = JSON { uid: string, exp: number, nonce: string }

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!secret) throw new Error('OAUTH_STATE_SECRET not configured');
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signOAuthState(userId: string, ttlSeconds = 600): Promise<string> {
  const payload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: b64urlEncode(crypto.getRandomValues(new Uint8Array(12))),
  };
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const payloadB64 = b64urlEncode(payloadBytes);
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export async function verifyOAuthState(state: string): Promise<string> {
  if (!state || !state.includes('.')) throw new Error('Invalid state');
  const [payloadB64, sigB64] = state.split('.');
  const key = await getKey();
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(sigB64),
    encoder.encode(payloadB64),
  );
  if (!ok) throw new Error('Invalid state signature');
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new Error('State expired');
  }
  if (typeof payload.uid !== 'string' || !payload.uid) {
    throw new Error('State missing user');
  }
  return payload.uid;
}
