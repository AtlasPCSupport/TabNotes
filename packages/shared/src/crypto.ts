/**
 * Note encryption utilities — AES-256-GCM with PBKDF2 key derivation.
 *
 * Layout of the base64 payload produced by {@link encryptText}:
 *   bytes 0..15   salt   (16 bytes)
 *   bytes 16..27  iv     (12 bytes)
 *   bytes 28..end ciphertext (AES-GCM, includes auth tag)
 *
 * Uses the Web Crypto API (`crypto.subtle`), available in both extension and
 * web contexts. Extracted from the side panel so it can be unit-tested.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = SALT_BYTES + IV_BYTES; // 28

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt `text` with `password`, returning a base64 string. */
export async function encryptText(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const buf = new Uint8Array(HEADER_BYTES + cipher.byteLength);
  buf.set(salt, 0);
  buf.set(iv, SALT_BYTES);
  buf.set(new Uint8Array(cipher), HEADER_BYTES);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Decrypt a base64 payload produced by {@link encryptText}.
 * Throws if the password is wrong or the data is corrupt (GCM auth failure).
 */
export async function decryptText(data: string, password: string): Promise<string> {
  const buf = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const key = await deriveKey(password, buf.slice(0, SALT_BYTES));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(SALT_BYTES, HEADER_BYTES) },
    key,
    buf.slice(HEADER_BYTES)
  );
  return new TextDecoder().decode(plain);
}

// ── PIN hashing ────────────────────────────────────────────────────────────
//
// The side panel PIN gate is UI-level deterrence, not data-at-rest security:
// notes remain readable in chrome.storage.local via devtools. For real
// protection use per-note AES encryption (encryptText/decryptText). We still
// never store the PIN itself — only a salted PBKDF2-SHA-256 hash, so the stored
// value cannot be trivially reversed.

const PIN_HASH_BYTES = 32;

/** A salted PIN hash record, safe to persist. */
export interface PinHash {
  /** base64-encoded 16-byte salt. */
  salt: string;
  /** base64-encoded PBKDF2-SHA-256 derived bits. */
  hash: string;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveBits(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    PIN_HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Hash a PIN with a fresh random salt. Returns a persistable {salt, hash}. */
export async function hashPin(pin: string): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(pin, salt);
  return { salt: toBase64(salt), hash: toBase64(derived) };
}

/** Constant-time-ish comparison of a candidate PIN against a stored hash. */
export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!stored?.salt || !stored?.hash) return false;
  const salt = fromBase64(stored.salt);
  const expected = fromBase64(stored.hash);
  const actual = await deriveBits(pin, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
