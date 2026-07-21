import { describe, it, expect, beforeAll } from 'vitest';
import { encryptText, decryptText, hashPin, verifyPin } from './crypto';

// jsdom does not expose Web Crypto; fall back to Node's global crypto.
beforeAll(async () => {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    g.crypto = webcrypto as unknown as Crypto;
  }
});

describe('encryptText / decryptText', () => {
  it('round-trips plaintext', async () => {
    const secret = 'sensitive note body 🔒';
    const enc = await encryptText(secret, 'hunter2');
    expect(enc).not.toContain(secret);
    const dec = await decryptText(enc, 'hunter2');
    expect(dec).toBe(secret);
  });

  it('produces different ciphertext each time (random salt/iv)', async () => {
    const a = await encryptText('same', 'pw');
    const b = await encryptText('same', 'pw');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong password', async () => {
    const enc = await encryptText('top secret', 'correct');
    await expect(decryptText(enc, 'wrong')).rejects.toBeDefined();
  });

  it('handles empty string', async () => {
    const enc = await encryptText('', 'pw');
    expect(await decryptText(enc, 'pw')).toBe('');
  });

  it('rejects truncated or malformed encrypted payloads', async () => {
    const enc = await encryptText('top secret', 'pw');
    await expect(decryptText(enc.slice(0, 12), 'pw')).rejects.toBeDefined();
    await expect(decryptText('not valid base64!', 'pw')).rejects.toBeDefined();
  });

  it('produces tnenc:v2: prefixed payloads', async () => {
    const enc = await encryptText('hello', 'pw');
    expect(enc.startsWith('tnenc:v2:')).toBe(true);
  });

  it('rejects unsupported encryption versions', async () => {
    await expect(decryptText('tnenc:v99:invalid', 'pw')).rejects.toThrow(
      'Unsupported encryption version.'
    );
  });

  it('preserves unicode text and a long plaintext payload', async () => {
    const secret = `${'📝 café — '.repeat(5_000)}end`;
    const enc = await encryptText(secret, 'pw');
    expect(await decryptText(enc, 'pw')).toBe(secret);
  });

  it('encrypts backup-sized payloads without exceeding browser argument limits', async () => {
    // btoa needs a binary string. This is larger than the argument limit of
    // String.fromCharCode(...bytes) in Chromium, which encrypted exports use.
    const secret = 'backup-data-'.repeat(50_000);
    const enc = await encryptText(secret, 'pw');
    expect(await decryptText(enc, 'pw')).toBe(secret);
  });
});

describe('hashPin / verifyPin', () => {
  it('verifies the correct PIN', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('1234', stored)).toBe(true);
  });

  it('rejects an incorrect PIN', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('0000', stored)).toBe(false);
  });

  it('never stores the PIN in plaintext', async () => {
    const stored = await hashPin('secret-pin');
    expect(stored.hash).not.toContain('secret-pin');
    expect(stored.salt).toBeTruthy();
    expect(stored.hash).toBeTruthy();
  });

  it('uses a random salt so the same PIN hashes differently', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // …yet both verify.
    expect(await verifyPin('1234', a)).toBe(true);
    expect(await verifyPin('1234', b)).toBe(true);
  });

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyPin('1234', { salt: '', hash: '' })).toBe(false);
  });
});
