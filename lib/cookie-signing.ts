/**
 * cookie-signing.ts
 * HMAC-SHA256 cookie signing / verification using Web Crypto API.
 *
 * Works in both Edge runtime (middleware) and Node.js 18+ (API routes).
 *
 * Format stored in cookie:
 *   encodeURIComponent(JSON_payload) + SEPARATOR + base64url(HMAC-SHA256(payload))
 *
 * SEPARATOR is '::' — never produced by encodeURIComponent or base64url.
 */

const SEPARATOR = '::';

/** Read signing secret from env, with a hard fallback (change in production). */
function getSecret(): string {
  return (
    process.env.COOKIE_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'zoiro-fallback-secret-must-change-in-prod'
  );
}

/** Import the secret as a HMAC-SHA256 CryptoKey. */
async function importKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

/** Encode a Uint8Array to base64url (no padding) for safe cookie storage. */
function toBase64url(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a base64url string back to Uint8Array. */
function fromBase64url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Sign a plain-text payload.
 * Returns `payload + SEPARATOR + base64url(signature)`.
 * The caller is responsible for encoding the payload (e.g. encodeURIComponent).
 */
export async function signCookieValue(payload: string): Promise<string> {
  const secret = getSecret();
  const key = await importKey(secret, ['sign']);
  const enc = new TextEncoder();
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sig = toBase64url(new Uint8Array(sigBuffer));
  return `${payload}${SEPARATOR}${sig}`;
}

/**
 * Verify a signed cookie value.
 * @returns The original payload string if the signature is valid, otherwise `null`.
 */
export async function verifyCookieValue(signed: string): Promise<string | null> {
  // Find the last occurrence of SEPARATOR to split payload and signature
  const idx = signed.lastIndexOf(SEPARATOR);
  if (idx === -1) return null;

  const payload = signed.slice(0, idx);
  const sigB64url = signed.slice(idx + SEPARATOR.length);

  if (!payload || !sigB64url) return null;

  const secret = getSecret();
  const key = await importKey(secret, ['verify']);
  const enc = new TextEncoder();

  try {
    const sigBytes = fromBase64url(sigB64url);
    // Copy into a fresh ArrayBuffer to satisfy SubtleCrypto's BufferSource type constraint
    const sigArrayBuffer = new Uint8Array(sigBytes).buffer as ArrayBuffer;
    const valid = await crypto.subtle.verify('HMAC', key, sigArrayBuffer, enc.encode(payload));
    return valid ? payload : null;
  } catch {
    // atob or key mismatch — treat as invalid
    return null;
  }
}
