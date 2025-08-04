// Shared crypto utility for Edge Functions
const algorithm = 'AES-GCM';

export function encrypt(text: string, secret: string): string {
  const key = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  return crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    false,
    ['encrypt']
  ).then(cryptoKey => {
    return crypto.subtle.encrypt(
      { name: algorithm, iv },
      cryptoKey,
      new TextEncoder().encode(text)
    );
  }).then(encrypted => {
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  });
}

export function decrypt(encryptedBase64: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
  const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  return crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    false,
    ['decrypt']
  ).then(cryptoKey => {
    return crypto.subtle.decrypt(
      { name: algorithm, iv },
      cryptoKey,
      encrypted
    );
  }).then(decrypted => {
    return new TextDecoder().decode(decrypted);
  });
}