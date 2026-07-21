/**
 * Note encryption utilities — AES-256-GCM with PBKDF2 key derivation.
 *
 * Layout of the base64 payload produced by {@link encryptText}:
 *   Prefix: "tnenc:v2:"
 *   bytes 0..15   salt   (16 bytes)
 *   bytes 16..27  iv     (12 bytes)
 *   bytes 28..end ciphertext (AES-GCM, includes auth tag)
 *
 * Legacy payloads without prefix use 100,000 iterations for backward compatibility.
 * V2 payloads use 600,000 iterations.
 */

export const PBKDF2_V2_ITERATIONS = 600_000;
export const PBKDF2_LEGACY_ITERATIONS = 100_000;
export const V2_PREFIX = 'tnenc:v2:';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = SALT_BYTES + IV_BYTES; // 28

function getCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }
  const BufferCtor = (
    globalThis as { Buffer?: { from(data: Uint8Array): { toString(format: string): string } } }
  ).Buffer;
  if (BufferCtor) return BufferCtor.from(bytes).toString('base64');
  throw new Error('No base64 encoder is available in this environment.');
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const BufferCtor = (
    globalThis as {
      Buffer?: { from(data: string, format: string): { length: number; [index: number]: number } };
    }
  ).Buffer;
  if (BufferCtor) return Uint8Array.from(BufferCtor.from(value, 'base64'));
  throw new Error('No base64 decoder is available in this environment.');
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_V2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const cryptoApi = getCrypto();
  const baseKey = await cryptoApi.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt `text` with `password`, returning a base64 string prefixed with "tnenc:v2:". */
export async function encryptText(text: string, password: string): Promise<string> {
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_V2_ITERATIONS);
  const cipher = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const buf = new Uint8Array(HEADER_BYTES + cipher.byteLength);
  buf.set(salt, 0);
  buf.set(iv, SALT_BYTES);
  buf.set(new Uint8Array(cipher), HEADER_BYTES);
  return `${V2_PREFIX}${bytesToBase64(buf)}`;
}

/**
 * Decrypt a payload produced by {@link encryptText}.
 * Handles v2 payloads ("tnenc:v2:...", 600,000 iterations) and legacy payloads (100,000 iterations).
 * Throws if the password is wrong, version is unknown, or data is corrupt.
 */
export async function decryptText(data: string, password: string): Promise<string> {
  let rawPayload = data;
  let iterations = PBKDF2_LEGACY_ITERATIONS;

  if (data.startsWith(V2_PREFIX)) {
    rawPayload = data.slice(V2_PREFIX.length);
    iterations = PBKDF2_V2_ITERATIONS;
  } else if (data.startsWith('tnenc:v')) {
    throw new Error('Unsupported encryption version.');
  }

  const buf = base64ToBytes(rawPayload);
  if (buf.length <= HEADER_BYTES) throw new Error('Encrypted data is incomplete or invalid.');
  const key = await deriveKey(password, buf.slice(0, SALT_BYTES), iterations);
  const plain = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(SALT_BYTES, HEADER_BYTES) },
    key,
    buf.slice(HEADER_BYTES)
  );
  return new TextDecoder().decode(plain);
}

// ── PIN hashing ────────────────────────────────────────────────────────────

const PIN_HASH_BYTES = 32;

/** A salted PIN hash record, safe to persist. Supports v2 (600k iterations). */
export interface PinHash {
  salt: string;
  hash: string;
  version?: number;
  iterations?: number;
}

function toBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

function fromBase64(b64: string): Uint8Array {
  return base64ToBytes(b64);
}

async function deriveBits(
  pin: string,
  salt: Uint8Array,
  iterations = PBKDF2_V2_ITERATIONS
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoApi = getCrypto();
  const baseKey = await cryptoApi.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    baseKey,
    PIN_HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Hash a PIN with a fresh random salt using v2 parameters (600,000 iterations). */
export async function hashPin(pin: string): Promise<PinHash> {
  const salt = getCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(pin, salt, PBKDF2_V2_ITERATIONS);
  return {
    salt: toBase64(salt),
    hash: toBase64(derived),
    version: 2,
    iterations: PBKDF2_V2_ITERATIONS,
  };
}

/** Verify a candidate PIN against a stored hash (supports legacy 100k and v2 600k hashes). */
export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!stored?.salt || !stored?.hash) return false;
  const iterations =
    stored.iterations ?? (stored.version === 2 ? PBKDF2_V2_ITERATIONS : PBKDF2_LEGACY_ITERATIONS);
  const salt = fromBase64(stored.salt);
  const expected = fromBase64(stored.hash);
  const actual = await deriveBits(pin, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

